import { AudioData, AudioInspectError, BiquadCoeffs } from '../types.js';
import { ensureValidSample } from '../core/utils.js';

// ITU-R BS.1770-4準拠の定数
const ABSOLUTE_GATE_LUFS = -70.0;
const RELATIVE_GATE_LU = 10.0;
const BLOCK_SIZE_MS = 400;
const BLOCK_OVERLAP = 0.75; // 75%オーバーラップ
const SHORT_TERM_WINDOW_MS = 3000;
const MOMENTARY_WINDOW_MS = 400;

// Biquadフィルタの状態
interface BiquadState {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

// K-weighting係数のキャッシュ
const kWeightingCache = new Map<number, BiquadCoeffs[]>();

/**
 * K特性フィルタ係数を設計（ITU-R BS.1770-4準拠）
 * @param sampleRate サンプルレート
 * @returns 2段のバイカッドフィルタ係数
 */
function designKWeighting(sampleRate: number): BiquadCoeffs[] {
  // キャッシュを確認
  const cached = kWeightingCache.get(sampleRate);
  if (cached) {
    return cached;
  }

  // ITU-R BS.1770-4 アナログ設計パラメータ
  // プリフィルタ: 高域シェルビング ~1680 Hz, +4 dB
  const fc1 = 1681.4; // Hz
  const gain1_db = 4.0; // dB
  const Q1 = 0.7071; // sqrt(2)/2

  // RLB フィルタ: 2nd order high-pass ~78 Hz
  const fc2 = 78.0; // Hz
  const Q2 = 0.5;

  // バイリニア変換
  const T = 1.0 / sampleRate;

  // Stage 1: High-frequency shelving (プリフィルタ)
  const A1 = Math.pow(10, gain1_db / 40); // ゲイン変換
  const w1 = 2 * Math.PI * fc1;
  const cosw1T = Math.cos(w1 * T);
  const sinw1T = Math.sin(w1 * T);
  const beta1 = Math.sqrt(A1) / Q1;

  const stage1_a0 = A1 * (A1 + 1 + (A1 - 1) * cosw1T + beta1 * sinw1T);
  const stage1_a1 = -2 * A1 * (A1 - 1 + (A1 + 1) * cosw1T);
  const stage1_a2 = A1 * (A1 + 1 + (A1 - 1) * cosw1T - beta1 * sinw1T);
  const stage1_b0 = A1 * (A1 + 1 - (A1 - 1) * cosw1T + beta1 * sinw1T);
  const stage1_b1 = 2 * A1 * (A1 - 1 - (A1 + 1) * cosw1T);
  const stage1_b2 = A1 * (A1 + 1 - (A1 - 1) * cosw1T - beta1 * sinw1T);

  // 正規化
  const stage1: BiquadCoeffs = {
    b0: stage1_b0 / stage1_a0,
    b1: stage1_b1 / stage1_a0,
    b2: stage1_b2 / stage1_a0,
    a0: 1.0,
    a1: stage1_a1 / stage1_a0,
    a2: stage1_a2 / stage1_a0
  };

  // Stage 2: RLB high-pass filter
  const w2 = 2 * Math.PI * fc2;
  const cosw2T = Math.cos(w2 * T);
  const sinw2T = Math.sin(w2 * T);
  const alpha2 = sinw2T / (2 * Q2);

  const stage2_a0 = 1 + alpha2;
  const stage2_a1 = -2 * cosw2T;
  const stage2_a2 = 1 - alpha2;
  const stage2_b0 = (1 + cosw2T) / 2;
  const stage2_b1 = -(1 + cosw2T);
  const stage2_b2 = (1 + cosw2T) / 2;

  const stage2: BiquadCoeffs = {
    b0: stage2_b0 / stage2_a0,
    b1: stage2_b1 / stage2_a0,
    b2: stage2_b2 / stage2_a0,
    a0: 1.0,
    a1: stage2_a1 / stage2_a0,
    a2: stage2_a2 / stage2_a0
  };

  const coeffs = [stage1, stage2];

  // キャッシュに保存
  kWeightingCache.set(sampleRate, coeffs);

  return coeffs;
}

// Biquadフィルタの適用
function applyBiquad(
  input: Float32Array,
  coeffs: BiquadCoeffs,
  state: BiquadState = { x1: 0, x2: 0, y1: 0, y2: 0 }
): Float32Array {
  const output = new Float32Array(input.length);
  let { x1, x2, y1, y2 } = state;

  for (let i = 0; i < input.length; i++) {
    const x0 = ensureValidSample(input[i] ?? 0);

    const y0 = coeffs.b0 * x0 + coeffs.b1 * x1 + coeffs.b2 * x2 - coeffs.a1 * y1 - coeffs.a2 * y2;

    output[i] = y0;

    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  // 状態を更新
  state.x1 = x1;
  state.x2 = x2;
  state.y1 = y1;
  state.y2 = y2;

  return output;
}

// K-weightingフィルタの適用
function applyKWeighting(channelData: Float32Array, sampleRate: number): Float32Array {
  const coeffs = designKWeighting(sampleRate);

  // Stage 1: プリフィルタ（高域シェルビング）
  let filtered = applyBiquad(channelData, coeffs[0]!);

  // Stage 2: RLB フィルタ（高域通過）
  filtered = applyBiquad(filtered, coeffs[1]!);

  return filtered;
}

// ブロックのラウドネス計算
function calculateBlockLoudness(channels: Float32Array[]): number {
  let sumOfSquares = 0;
  const numChannels = channels.length;

  if (numChannels === 0) return -Infinity;

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = channels[ch];
    if (!channelData || channelData.length === 0) continue;

    let channelSum = 0;
    let validSamples = 0;

    for (let i = 0; i < channelData.length; i++) {
      const sample = ensureValidSample(channelData[i] ?? 0);
      channelSum += sample * sample;
      validSamples++;
    }

    if (validSamples === 0) continue;

    // チャンネル重み付け（ステレオの場合）
    const channelWeight = 1.0; // L, R, Cは1.0、Ls, Rsは1.41（サラウンドの場合）
    sumOfSquares += channelWeight * (channelSum / validSamples);
  }

  // LUFSに変換
  return -0.691 + 10 * Math.log10(Math.max(1e-15, sumOfSquares));
}

export interface LUFSOptions {
  channelMode?: 'mono' | 'stereo';
  gated?: boolean;
  calculateShortTerm?: boolean;
  calculateMomentary?: boolean;
  calculateLoudnessRange?: boolean;
  calculateTruePeak?: boolean;
}

export interface LUFSResult {
  integrated: number; // Integrated loudness (LUFS)
  shortTerm?: Float32Array; // Short-term loudness values
  momentary?: Float32Array; // Momentary loudness values
  loudnessRange?: number; // Loudness range (LU)
  truePeak?: number[]; // True peak per channel (dBTP)
  statistics?: {
    percentile10: number; // 10th percentile
    percentile95: number; // 95th percentile
  };
}

export function getLUFS(audio: AudioData, options: LUFSOptions = {}): LUFSResult {
  const {
    channelMode = audio.numberOfChannels >= 2 ? 'stereo' : 'mono',
    gated = true,
    calculateShortTerm = false,
    calculateMomentary = false,
    calculateLoudnessRange = false,
    calculateTruePeak = false
  } = options;

  if (audio.numberOfChannels === 0) {
    throw new AudioInspectError('INVALID_INPUT', '処理可能なチャンネルがありません');
  }

  // チャンネルデータの準備
  const channelsToProcess: Float32Array[] = [];

  if (channelMode === 'mono') {
    const channel0 = audio.channelData[0];
    if (channel0) {
      channelsToProcess.push(channel0);
    }
  } else {
    // ステレオ処理
    const channel0 = audio.channelData[0];
    const channel1 = audio.channelData[1];
    if (channel0) channelsToProcess.push(channel0);
    if (channel1) channelsToProcess.push(channel1);
  }

  if (channelsToProcess.length === 0) {
    throw new AudioInspectError('INVALID_INPUT', '処理可能なチャンネルがありません');
  }

  // K-weightingの適用（サンプルレート依存）
  const kWeightedChannels = channelsToProcess.map((ch) => applyKWeighting(ch, audio.sampleRate));

  // ブロック処理のパラメータ
  const sampleRate = audio.sampleRate;
  const blockSizeSamples = Math.floor((BLOCK_SIZE_MS / 1000) * sampleRate);
  const hopSizeSamples = Math.floor(blockSizeSamples * (1 - BLOCK_OVERLAP));
  const dataLength = kWeightedChannels[0]?.length ?? 0;

  if (dataLength === 0) {
    return { integrated: -Infinity };
  }

  // Integrated Loudness の計算
  const blockLoudnessValues: number[] = [];

  for (let pos = 0; pos + blockSizeSamples <= dataLength; pos += hopSizeSamples) {
    const blockChannels = kWeightedChannels.map((ch) => ch.subarray(pos, pos + blockSizeSamples));

    const loudness = calculateBlockLoudness(blockChannels);
    if (isFinite(loudness)) {
      blockLoudnessValues.push(loudness);
    }
  }

  let integratedLoudness = -Infinity;

  if (blockLoudnessValues.length > 0) {
    let finalLoudnessValues = [...blockLoudnessValues];

    if (gated) {
      // 絶対ゲート（-70 LUFS）
      finalLoudnessValues = finalLoudnessValues.filter((l) => l >= ABSOLUTE_GATE_LUFS);

      if (finalLoudnessValues.length > 0) {
        // 相対ゲートのための平均計算
        const sumPower = finalLoudnessValues.reduce((sum, lufs) => {
          return sum + Math.pow(10, (lufs + 0.691) / 10);
        }, 0);

        const meanLoudness = -0.691 + 10 * Math.log10(sumPower / finalLoudnessValues.length);
        const relativeThreshold = meanLoudness - RELATIVE_GATE_LU;

        // 相対ゲート適用
        finalLoudnessValues = finalLoudnessValues.filter((l) => l >= relativeThreshold);
      }
    }

    if (finalLoudnessValues.length > 0) {
      // 最終的なIntegrated Loudness
      const sumPower = finalLoudnessValues.reduce((sum, lufs) => {
        return sum + Math.pow(10, (lufs + 0.691) / 10);
      }, 0);

      integratedLoudness = -0.691 + 10 * Math.log10(sumPower / finalLoudnessValues.length);
    }
  }

  const result: LUFSResult = {
    integrated: integratedLoudness
  };

  // Short-term Loudness（オプション）
  if (calculateShortTerm) {
    const shortTermSamples = Math.floor((SHORT_TERM_WINDOW_MS / 1000) * sampleRate);
    const shortTermHop = hopSizeSamples;
    const shortTermValues: number[] = [];

    for (let pos = 0; pos + shortTermSamples <= dataLength; pos += shortTermHop) {
      const windowChannels = kWeightedChannels.map((ch) =>
        ch.subarray(pos, pos + shortTermSamples)
      );

      const loudness = calculateBlockLoudness(windowChannels);
      if (isFinite(loudness)) {
        shortTermValues.push(loudness);
      }
    }

    result.shortTerm = new Float32Array(shortTermValues);
  }

  // Momentary Loudness（オプション）
  if (calculateMomentary) {
    const momentarySamples = Math.floor((MOMENTARY_WINDOW_MS / 1000) * sampleRate);
    const momentaryHop = hopSizeSamples;
    const momentaryValues: number[] = [];

    for (let pos = 0; pos + momentarySamples <= dataLength; pos += momentaryHop) {
      const windowChannels = kWeightedChannels.map((ch) =>
        ch.subarray(pos, pos + momentarySamples)
      );

      const loudness = calculateBlockLoudness(windowChannels);
      if (isFinite(loudness)) {
        momentaryValues.push(loudness);
      }
    }

    result.momentary = new Float32Array(momentaryValues);
  }

  // Loudness Range（オプション）
  if (calculateLoudnessRange && result.shortTerm) {
    const validValues = Array.from(result.shortTerm)
      .filter((v) => v > ABSOLUTE_GATE_LUFS && isFinite(v))
      .sort((a, b) => a - b);

    if (validValues.length > 0) {
      const percentile10Index = Math.floor(validValues.length * 0.1);
      const percentile95Index = Math.floor(validValues.length * 0.95);

      const percentile10 = validValues[percentile10Index] ?? -Infinity;
      const percentile95 = validValues[percentile95Index] ?? -Infinity;

      result.loudnessRange = percentile95 - percentile10;
      result.statistics = { percentile10, percentile95 };
    }
  }

  // True Peak（オプション - 簡易実装）
  if (calculateTruePeak) {
    result.truePeak = channelsToProcess.map((ch) => {
      let peak = 0;
      for (const sample of ch) {
        const sampleValue = ensureValidSample(sample ?? 0);
        peak = Math.max(peak, Math.abs(sampleValue));
      }
      return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
    });
  }

  return result;
}
