import { AudioData, AudioInspectError } from '../types.js';
import { getFFT } from './frequency.js';
import { ensureValidSample } from '../core/utils.js';

export interface StereoAnalysisOptions {
  frameSize?: number; // 分析フレームサイズ（サンプル数）
  hopSize?: number; // ホップサイズ（サンプル数）
  calculatePhase?: boolean; // 位相解析を行うか
  calculateITD?: boolean; // 両耳間時間差を計算するか
  calculateILD?: boolean; // 両耳間レベル差を計算するか
}

export interface StereoAnalysisResult {
  correlation: number; // 相関係数 (-1 to 1)
  coherence?: Float32Array; // 周波数別コヒーレンス
  width: number; // ステレオ幅 (0 to 1)
  widthFrequency?: Float32Array; // 周波数別ステレオ幅
  balance: number; // L/R バランス (-1 to 1)
  phaseDifference?: number; // 平均位相差（度）
  phaseCorrelation?: number; // 位相相関 (-1 to 1)
  midSideRatio: number; // Mid/Side エネルギー比 (dB)
  itd?: number; // 両耳間時間差 (ms)
  ild?: number; // 両耳間レベル差 (dB)
  goniometer?: {
    // ゴニオメーター用データ
    x: Float32Array; // L-R (Side)
    y: Float32Array; // L+R (Mid)
  };
}

// クロス相関による遅延推定
function estimateDelay(
  left: Float32Array,
  right: Float32Array,
  maxDelaySamples: number = 44
): number {
  const len = Math.min(left.length, right.length);
  let maxCorr = -Infinity;
  let bestDelay = 0;

  for (let delay = -maxDelaySamples; delay <= maxDelaySamples; delay++) {
    let correlation = 0;
    let count = 0;

    for (let i = 0; i < len; i++) {
      const leftIdx = i;
      const rightIdx = i + delay;

      if (rightIdx >= 0 && rightIdx < len) {
        const leftSample = ensureValidSample(left[leftIdx] ?? 0);
        const rightSample = ensureValidSample(right[rightIdx] ?? 0);
        correlation += leftSample * rightSample;
        count++;
      }
    }

    if (count > 0) {
      correlation /= count;
      if (correlation > maxCorr) {
        maxCorr = correlation;
        bestDelay = delay;
      }
    }
  }

  return bestDelay;
}

// コヒーレンス計算（最適化版）
async function calculateCoherence(
  leftFFT: { magnitude: Float32Array; phase: Float32Array },
  rightFFT: { magnitude: Float32Array; phase: Float32Array }
): Promise<Float32Array> {
  const coherence = new Float32Array(leftFFT.magnitude.length);

  for (let i = 0; i < coherence.length; i++) {
    const leftMag = leftFFT.magnitude[i] ?? 0;
    const rightMag = rightFFT.magnitude[i] ?? 0;
    const phaseDiff = (leftFFT.phase[i] ?? 0) - (rightFFT.phase[i] ?? 0);

    // 位相差を考慮したクロススペクトルの実部のみを使用
    const crossReal = leftMag * rightMag * Math.cos(phaseDiff);

    const denominator = leftMag * leftMag * rightMag * rightMag;
    coherence[i] = denominator > 1e-10 ? (crossReal * crossReal) / denominator : 0;
  }

  return coherence;
}

// 周波数別ステレオ幅
function calculateFrequencyWidth(
  leftMag: Float32Array,
  rightMag: Float32Array,
  leftPhase: Float32Array,
  rightPhase: Float32Array
): Float32Array {
  const width = new Float32Array(leftMag.length);

  for (let i = 0; i < width.length; i++) {
    const lMag = leftMag[i] || 0;
    const rMag = rightMag[i] || 0;
    const lPhase = leftPhase[i] || 0;
    const rPhase = rightPhase[i] || 0;
    const phaseDiff = lPhase - rPhase;

    // M/S変換
    const midMag = Math.abs(lMag + rMag) / 2;
    const sideMag = Math.abs(lMag - rMag) / 2;

    // 位相差も考慮したステレオ幅
    const phaseWidth = Math.abs(Math.sin(phaseDiff / 2));
    const magWidth = sideMag / (midMag + sideMag + 1e-10);

    width[i] = Math.max(magWidth, phaseWidth);
  }

  return width;
}

export async function getStereoAnalysis(
  audio: AudioData,
  options: StereoAnalysisOptions = {}
): Promise<StereoAnalysisResult> {
  if (audio.numberOfChannels < 2) {
    throw new AudioInspectError('INVALID_INPUT', 'ステレオ解析には2チャンネル以上の音声が必要です');
  }

  const {
    frameSize = Math.min(8192, audio.length), // デフォルトを8192に制限
    calculatePhase = false, // デフォルトをfalseに変更
    calculateITD = false, // デフォルトをfalseに変更
    calculateILD = false // デフォルトをfalseに変更
  } = options;

  const left = audio.channelData[0];
  const right = audio.channelData[1];

  if (!left || !right) {
    throw new AudioInspectError('INVALID_INPUT', 'L/Rチャンネルのデータが存在しません');
  }

  const len = Math.min(left.length, right.length);

  if (len === 0) {
    return {
      correlation: 0,
      width: 0,
      balance: 0,
      midSideRatio: 0
    };
  }

  // 基本的な統計量の計算（最適化版）
  let sumL = 0,
    sumR = 0,
    sumLR = 0,
    sumL2 = 0,
    sumR2 = 0;
  let energyL = 0,
    energyR = 0;
  let energyMid = 0,
    energySide = 0;

  // ゴニオメーター用データ（基本版）
  const mid = new Float32Array(len);
  const side = new Float32Array(len);

  // 1回のループで全ての統計量とゴニオメーター用データを計算
  for (let i = 0; i < len; i++) {
    const l = ensureValidSample(left[i] ?? 0);
    const r = ensureValidSample(right[i] ?? 0);

    sumL += l;
    sumR += r;
    sumLR += l * r;
    sumL2 += l * l;
    sumR2 += r * r;

    energyL += l * l;
    energyR += r * r;

    // Mid/Side計算も同時に実行
    const midVal = (l + r) * 0.5;
    const sideVal = (l - r) * 0.5;

    energyMid += midVal * midVal;
    energySide += sideVal * sideVal;

    // ゴニオメーター用データも同時に保存
    mid[i] = midVal;
    side[i] = sideVal;
  }

  // 相関係数
  const meanL = sumL / len;
  const meanR = sumR / len;
  const covariance = sumLR / len - meanL * meanR;
  const stdL = Math.sqrt(sumL2 / len - meanL * meanL);
  const stdR = Math.sqrt(sumR2 / len - meanR * meanR);
  const correlation = stdL > 1e-10 && stdR > 1e-10 ? covariance / (stdL * stdR) : 0;

  // メトリクスの計算
  const width = energyMid + energySide > 1e-10 ? energySide / (energyMid + energySide) : 0;
  const balance = energyL + energyR > 1e-10 ? (energyR - energyL) / (energyL + energyR) : 0;
  const midSideRatio = energySide > 1e-10 ? 10 * Math.log10(energyMid / energySide) : Infinity;

  const result: StereoAnalysisResult = {
    correlation,
    width,
    balance,
    midSideRatio
  };

  // ゴニオメーター用データ（常に設定）
  result.goniometer = {
    x: side, // L-R
    y: mid // L+R
  };

  // 位相解析（オプション、FFT計算を最適化）
  if (calculatePhase) {
    const actualFrameSize = Math.min(frameSize, len);
    const fftSize = Math.pow(2, Math.ceil(Math.log2(actualFrameSize)));

    // FFTを並列実行
    const [leftFFT, rightFFT] = await Promise.all([
      getFFT(
        {
          channelData: [left.subarray(0, actualFrameSize)],
          sampleRate: audio.sampleRate,
          numberOfChannels: 1,
          length: actualFrameSize,
          duration: actualFrameSize / audio.sampleRate
        },
        { fftSize }
      ),
      getFFT(
        {
          channelData: [right.subarray(0, actualFrameSize)],
          sampleRate: audio.sampleRate,
          numberOfChannels: 1,
          length: actualFrameSize,
          duration: actualFrameSize / audio.sampleRate
        },
        { fftSize }
      )
    ]);

    // コヒーレンス計算（最適化版）
    result.coherence = await calculateCoherence(leftFFT, rightFFT);

    // 周波数別ステレオ幅
    result.widthFrequency = calculateFrequencyWidth(
      leftFFT.magnitude,
      rightFFT.magnitude,
      leftFFT.phase,
      rightFFT.phase
    );

    // 平均位相差（最適化版）
    let phaseDiffSum = 0;
    let weightSum = 0;

    for (let i = 1; i < leftFFT.phase.length; i++) {
      // DC成分を除外
      const leftMag = leftFFT.magnitude[i] || 0;
      const rightMag = rightFFT.magnitude[i] || 0;
      const leftPhase = leftFFT.phase[i] || 0;
      const rightPhase = rightFFT.phase[i] || 0;

      const weight = leftMag * rightMag;
      let phaseDiff = leftPhase - rightPhase;

      // 位相差を -π から π の範囲に正規化（高速版）
      phaseDiff = ((phaseDiff + Math.PI) % (2 * Math.PI)) - Math.PI;

      phaseDiffSum += phaseDiff * weight;
      weightSum += weight;
    }

    result.phaseDifference = weightSum > 1e-10 ? ((phaseDiffSum / weightSum) * 180) / Math.PI : 0;
  }

  // ITD（両耳間時間差）計算（オプション）
  if (calculateITD) {
    const delaySamples = estimateDelay(
      left.subarray(0, Math.min(frameSize, len)),
      right.subarray(0, Math.min(frameSize, len))
    );
    result.itd = (delaySamples / audio.sampleRate) * 1000; // ms
  }

  // ILD（両耳間レベル差）計算（オプション）
  if (calculateILD) {
    const rmsL = Math.sqrt(energyL / len);
    const rmsR = Math.sqrt(energyR / len);

    result.ild = rmsL > 1e-10 && rmsR > 1e-10 ? 20 * Math.log10(rmsR / rmsL) : 0;
  }

  return result;
}

// 時系列ステレオ解析（将来の拡張用）
export function getTimeVaryingStereoAnalysis(
  _audio: AudioData,
  _options: StereoAnalysisOptions & { windowSize?: number } = {}
): Promise<{
  times: Float32Array;
  correlation: Float32Array;
  width: Float32Array;
  balance: Float32Array;
}> {
  return Promise.reject(
    new AudioInspectError(
      'UNSUPPORTED_FORMAT',
      '時系列ステレオ解析は将来のバージョンで実装予定です'
    )
  );
}
