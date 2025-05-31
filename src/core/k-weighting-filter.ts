import { AudioInspectError, BiquadCoeffs } from '../types.js';

// K-weightingフィルタの係数キャッシュ
const kWeightingCache = new Map<number, BiquadCoeffs[]>();

/**
 * サンプルレートの妥当性を検証します。
 * ITU-R BS.1770-5 で推奨される範囲とデジタル信号処理の制約を考慮します。
 *
 * @param sampleRate サンプルレート (Hz)
 * @throws {AudioInspectError} 無効なサンプルレートの場合
 *
 * @remarks
 * ITU-R BS.1770-5 は特定のサンプルレートを要求しませんが、
 * 参照実装として 48kHz が提供されています。
 */
function validateSampleRate(sampleRate: number): void {
  if (!isFinite(sampleRate) || sampleRate <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'サンプルレートは正の有限値である必要があります');
  }

  if (sampleRate < 8000 || sampleRate > 384000) {
    throw new AudioInspectError(
      'UNSUPPORTED_FORMAT',
      `サンプルレート ${sampleRate}Hz はサポートされていません`
    );
  }

  // ITU-R BS.1770-5 では整数制限はありませんが、
  // 実用的には整数サンプルレートが一般的です
}

/**
 * K-weightingフィルタを設計します。
 *
 * @param sampleRate サンプルレート (Hz)
 * @returns K-weightingフィルタのバイカッド係数の配列（2段構成）
 *
 * @remarks
 * ### 設計仕様
 * - **規格準拠**: ITU-R BS.1770-5 (最新版)
 * - **学術根拠**: Brecht De Man氏の研究に基づく正確な係数導出
 * - **実装参考**: Christian Steinmetz氏のpyloudnormプロジェクト
 * - **段数**: 2段カスケード（高域シェルフ + ハイパス）
 * - **サンプルレート対応**: 全レートで統一的なアナログプロトタイプ導出
 * - **正規化**: 48kHz=公式係数使用、他=997Hzで0dB（ITU-R規格NOTE 1準拠）
 *
 * ### フィルタ構成
 * 1. **Stage 1**: 高域シェルフフィルタ (+4dB @ 1681.97Hz)
 * 2. **Stage 2**: 高域通過フィルタ (RLBフィルタ、fc=38.13Hz)
 *
 * ### 48kHz特別扱いの理由
 * ITU-R BS.1770-5は48kHz実装の公式係数（Table 1, 2）を提供しています。
 * この係数は既に特定の正規化が適用されており、997Hzで約0.7dBを示します。
 * 他のサンプルレートでは、同じ周波数応答を提供するため997Hzで0dB正規化を行います。
 *
 * ### 目的
 * 人間の聴感特性に基づくラウドネス測定のための
 * 周波数重み付けを実現します。
 */
export function designKWeighting(sampleRate: number): BiquadCoeffs[] {
  validateSampleRate(sampleRate);

  // キャッシュ確認
  const cached = kWeightingCache.get(sampleRate);
  if (cached) {
    return cached;
  }

  const coeffs: BiquadCoeffs[] = [];

  // ITU-R BS.1770-5準拠: 48kHz時は公式参照係数、他は算出
  if (sampleRate === 48000) {
    // Stage 1: ITU-R BS.1770-5 Annex 1 Table 1（公式参照係数）
    // 注：公式係数は規格で提供される特定の正規化が適用済み
    coeffs.push({
      b0: 1.53512485958697,
      b1: -2.69169618940638,
      b2: 1.19839281085285,
      a0: 1,
      a1: -1.69065929318241,
      a2: 0.73248077421585
    });

    // Stage 2: ITU-R BS.1770-5 Annex 1 Table 2（公式参照係数）
    coeffs.push({
      b0: 1.0,
      b1: -2.0,
      b2: 1.0,
      a0: 1,
      a1: -1.99004745483398,
      a2: 0.99007225036621
    });

    // 48kHz公式係数は規格提供のまま使用（997Hzで約0.7dB）
  } else {
    // 他のサンプルレート: ITU-R規格要求「同じ周波数応答を提供」
    // Brecht De Man氏の研究に基づく正確な係数導出

    // Stage 1: 高域シェルフフィルタ
    const f0 = 1681.9744509555319; // Hz
    const G = 3.99984385397; // dB
    const Q = 0.7071752369554193; // ≈ 1/√2

    const K = Math.tan((Math.PI * f0) / sampleRate);
    const Vh = Math.pow(10.0, G / 20.0);
    const Vb = Math.pow(Vh, 0.499666774155);
    const norm = 1.0 + K / Q + K * K;

    coeffs.push({
      b0: (Vh + (Vb * K) / Q + K * K) / norm,
      b1: (2.0 * (K * K - Vh)) / norm,
      b2: (Vh - (Vb * K) / Q + K * K) / norm,
      a0: 1,
      a1: (2.0 * (K * K - 1.0)) / norm,
      a2: (1.0 - K / Q + K * K) / norm
    });

    // Stage 2: 高域通過フィルタ
    const fc = 38.13547087613982; // Hz
    const Qc = 0.5003270373253953; // Q値

    const K2 = Math.tan((Math.PI * fc) / sampleRate);
    const norm2 = 1.0 + K2 / Qc + K2 * K2;

    coeffs.push({
      b0: 1.0,
      b1: -2.0,
      b2: 1.0,
      a0: 1,
      a1: (2.0 * (K2 * K2 - 1.0)) / norm2,
      a2: (1.0 - K2 / Qc + K2 * K2) / norm2
    });

    // ITU-R BS.1770-5準拠: 997Hz(≈1000Hz)で0dB正規化
    // 規格NOTE 1: "The constant −0.691 cancels out the K-weighting gain for 997 Hz"
    const response997 = calculateFrequencyResponse(coeffs, 997, sampleRate);
    const normGain = 1.0 / response997.magnitude;

    // 第1段のb係数に正規化ゲインを適用
    if (coeffs[0]) {
      coeffs[0].b0 *= normGain;
      coeffs[0].b1 *= normGain;
      coeffs[0].b2 *= normGain;
    }
  }

  // キャッシュに保存
  kWeightingCache.set(sampleRate, coeffs);
  return coeffs;
}

export function calculateFrequencyResponse(
  coeffs: BiquadCoeffs[],
  frequency: number,
  sampleRate: number
): { magnitude: number; phase: number } {
  const omega = (2 * Math.PI * frequency) / sampleRate;

  let h_real = 1.0;
  let h_imag = 0.0;

  for (const coeff of coeffs) {
    const cos_omega = Math.cos(omega);
    const sin_omega = Math.sin(omega);
    const cos_2omega = Math.cos(2 * omega);
    const sin_2omega = Math.sin(2 * omega);

    const num_real = coeff.b0 + coeff.b1 * cos_omega + coeff.b2 * cos_2omega;
    const num_imag = -coeff.b1 * sin_omega - coeff.b2 * sin_2omega;

    const den_real = coeff.a0 + coeff.a1 * cos_omega + coeff.a2 * cos_2omega;
    const den_imag = -coeff.a1 * sin_omega - coeff.a2 * sin_2omega;

    const den_mag_sq = den_real * den_real + den_imag * den_imag;
    if (den_mag_sq === 0) {
      throw new AudioInspectError('INVALID_INPUT', '周波数応答計算でゼロ除算が発生しました');
    }

    const h_stage_real = (num_real * den_real + num_imag * den_imag) / den_mag_sq;
    const h_stage_imag = (num_imag * den_real - num_real * den_imag) / den_mag_sq;

    const new_real = h_real * h_stage_real - h_imag * h_stage_imag;
    const new_imag = h_real * h_stage_imag + h_imag * h_stage_real;
    h_real = new_real;
    h_imag = new_imag;
  }

  const magnitude = Math.sqrt(h_real * h_real + h_imag * h_imag);
  const phase = Math.atan2(h_imag, h_real);

  return { magnitude, phase };
}

/**
 * 指定されたサンプルレートに対応するK-weightingフィルタのバイカッド係数を取得します。
 * ITU-R BS.1770-5 に基づいています。
 *
 * @param sampleRate サンプルレート (Hz)
 * @returns K-weightingフィルタのバイカッド係数の配列（2段構成）
 * @throws {AudioInspectError} 無効なサンプルレートの場合
 *
 * @remarks
 * ### 用途
 * - **ラウドネス測定**: LUFS (Loudness Units relative to Full Scale)
 * - **放送規格**: EBU R128, ATSC A/85 等で採用
 * - **音響品質評価**: 人間の聴感特性を考慮した音量評価
 *
 * ### 特性
 * - 低域: 38Hz以下を減衰（ランブルフィルタ）
 * - 高域: 1.7kHz以上を約+4dB増強（聴感補正）
 */
export function getKWeightingCoeffs(sampleRate: number): BiquadCoeffs[] {
  return designKWeighting(sampleRate);
}
