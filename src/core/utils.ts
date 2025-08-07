import { AudioInspectError, type AudioData, type BiquadCoeffs } from '../types.js';
// 専用フィルタファイルからインポート
import {
  getAWeightingCoeffs as getAWeightingCoeffsImpl,
  calculateFrequencyResponse as calculateFrequencyResponseImpl,
  designAWeighting
} from './a-weighting-filter.js';

/**
 * Cross-platform performance timing function
 * Works in both browser and Node.js environments
 * @returns Current time in milliseconds
 */
export function getPerformanceNow(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  // Node.js fallback using process.hrtime
  if (typeof process !== 'undefined' && process.hrtime) {
    const [seconds, nanoseconds] = process.hrtime();
    return seconds * 1000 + nanoseconds / 1000000;
  }
  // Ultimate fallback
  return Date.now();
}

/**
 * Safely get channel data common function
 * @param audio - AudioData object
 * @param channel - Channel number (-1 for average of all channels)
 * @returns Data of the specified channel
 * @throws AudioInspectError if channel is invalid
 */
export function getChannelData(audio: AudioData, channel = 0): Float32Array {
  if (channel === -1) {
    // Calculate average across all channels
    if (audio.numberOfChannels === 0) {
      throw new AudioInspectError('INVALID_INPUT', 'No channels available');
    }

    // Check if any channel is undefined
    for (let ch = 0; ch < audio.numberOfChannels; ch++) {
      if (!audio.channelData[ch]) {
        throw new AudioInspectError(
          'INVALID_INPUT',
          `Channel ${ch} data does not exist for averaging`
        );
      }
    }

    const averageData = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        const channelData = audio.channelData[ch];
        if (channelData && i < channelData.length) {
          sum += channelData[i] ?? 0;
        }
      }
      averageData[i] = sum / audio.numberOfChannels;
    }
    return averageData;
  }

  if (channel < -1 || channel >= audio.numberOfChannels) {
    throw new AudioInspectError('INVALID_INPUT', `Invalid channel number: ${channel}`);
  }

  const channelData = audio.channelData[channel];
  if (!channelData) {
    throw new AudioInspectError('INVALID_INPUT', `Channel ${channel} data does not exist`);
  }

  return channelData;
}

/**
 * Check if a number is a power of two
 */
export function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

/**
 * Calculate the next power of two
 */
export function nextPowerOfTwo(value: number): number {
  if (value <= 0 || !isFinite(value) || isNaN(value)) return 1;
  if (isPowerOfTwo(value)) return value;

  let power = 1;
  while (power < value && power < Number.MAX_SAFE_INTEGER) {
    power *= 2;
  }
  return power;
}

/**
 * Type-safe array access
 */
export function safeArrayAccess<T>(arr: T[], index: number, defaultValue: T): T {
  if (index < 0 || index >= arr.length) {
    return defaultValue;
  }
  return arr[index] ?? defaultValue;
}

/**
 * Validate number validity
 */
export function isValidSample(sample: number): boolean {
  // Check for null/undefined values that are cast to number
  if (sample == null) return false;
  return !isNaN(sample) && isFinite(sample);
}

/**
 * Safe retrieval of sample values
 */
export function ensureValidSample(sample: number): number {
  // Check for null/undefined values that are cast to number
  if (sample == null || isNaN(sample) || !isFinite(sample)) {
    return 0;
  }
  return sample;
}

/**
 * Safe allocation of Float32Array
 */
export function ensureFloat32Array(
  data: Float32Array | undefined | null,
  length: number
): Float32Array {
  if (data instanceof Float32Array && data.length === length) {
    return data;
  }
  return new Float32Array(length);
}

/**
 * Convert amplitude to dB
 */
export function amplitudeToDecibels(amplitude: number, reference = 1.0): number {
  if (amplitude <= 0 || reference <= 0) return -Infinity;
  return 20 * Math.log10(amplitude / reference);
}

/**
 * Convert dB to amplitude
 */
export function decibelsToAmplitude(decibels: number, reference = 1.0): number {
  if (decibels === -Infinity) return 0;
  return reference * Math.pow(10, decibels / 20);
}

/**
 * ステレオオーディオをモノラルに変換
 */
export function toMono(audio: AudioData): AudioData {
  if (audio.numberOfChannels === 1) {
    return audio;
  }

  const monoData = new Float32Array(audio.length);
  const channelCount = audio.numberOfChannels;

  for (let i = 0; i < audio.length; i++) {
    let sum = 0;
    for (let ch = 0; ch < channelCount; ch++) {
      sum += audio.channelData[ch]?.[i] ?? 0;
    }
    monoData[i] = sum / channelCount;
  }

  return {
    ...audio,
    channelData: [monoData],
    numberOfChannels: 1
  };
}

/**
 * オーディオデータを時間範囲でスライス
 */
export function sliceAudio(audio: AudioData, startTime: number, endTime: number): AudioData {
  if (startTime < 0 || endTime < 0 || startTime >= endTime) {
    throw new AudioInspectError('INVALID_INPUT', '無効な時間範囲が指定されました', {
      startTime,
      endTime
    });
  }

  if (endTime > audio.duration) {
    throw new AudioInspectError('INVALID_INPUT', '終了時間が音声の長さを超えています', {
      endTime,
      duration: audio.duration
    });
  }

  const startSample = Math.floor(startTime * audio.sampleRate);
  const endSample = Math.min(Math.floor(endTime * audio.sampleRate), audio.length);
  const length = endSample - startSample;

  if (length <= 0) {
    throw new AudioInspectError('INSUFFICIENT_DATA', 'スライス範囲が小さすぎます', {
      startSample,
      endSample,
      length
    });
  }

  const slicedChannels = audio.channelData.map((channel) => channel.slice(startSample, endSample));

  return {
    ...audio,
    channelData: slicedChannels,
    duration: endTime - startTime,
    length
  };
}

/**
 * オーディオデータを正規化（-1〜1の範囲に）
 */
export function normalizeAudio(audio: AudioData): AudioData {
  let maxAmplitude = 0;

  // 最大振幅を検出
  for (const channel of audio.channelData) {
    for (const sample of channel) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
    }
  }

  if (maxAmplitude === 0 || maxAmplitude === 1) {
    return audio;
  }

  // 正規化
  const normalizedChannels = audio.channelData.map((channel) => {
    const normalized = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      normalized[i] = (channel[i] ?? 0) / maxAmplitude;
    }
    return normalized;
  });

  return {
    ...audio,
    channelData: normalizedChannels
  };
}

/**
 * 2次IIRフィルタの状態管理
 */
interface BiquadState {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

/**
 * 周波数応答の結果
 */
interface FrequencyResponse {
  magnitude: number;
  phase: number;
}

/**
 * フィルタ係数の周波数応答を計算
 * @param coeffs フィルタ係数配列
 * @param frequency 周波数（Hz）
 * @param sampleRate サンプルレート
 * @returns 周波数応答
 */
export function calculateFrequencyResponse(
  coeffs: BiquadCoeffs[],
  frequency: number,
  sampleRate: number
): FrequencyResponse {
  return calculateFrequencyResponseImpl(coeffs, frequency, sampleRate);
}

/**
 * テスト用：A-weightingフィルタ係数を取得
 * @param sampleRate サンプルレート
 * @returns A-weightingフィルタ係数
 */
export function getAWeightingCoeffs(sampleRate: number): BiquadCoeffs[] {
  return getAWeightingCoeffsImpl(sampleRate);
}

/**
 * バイカッドフィルタの適用（新式）
 */
function applyBiquadNew(
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

/**
 * A特性フィルタを適用（新規格準拠版）
 * IEC 61672準拠のA特性フィルタ実装
 * @param samples 入力サンプル
 * @param sampleRate サンプルレート
 * @returns A特性フィルタを適用したサンプル
 */
export function applyAWeighting(samples: Float32Array, sampleRate: number): Float32Array {
  const coeffs = designAWeighting(sampleRate);

  let filtered = samples;

  // 4段のバイカッドフィルタを直列接続
  for (const coeff of coeffs) {
    filtered = applyBiquadNew(filtered, coeff);
  }

  return filtered;
}

/**
 * オーバーサンプリングのオプション
 */
export interface OversamplingOptions {
  /** オーバーサンプリング倍率 (2, 4, 8) */
  factor?: number;
  /** フィルタタイプ ('linear' | 'cubic' | 'sinc') */
  interpolation?: 'linear' | 'cubic' | 'sinc';
}

/**
 * 線形補間によるオーバーサンプリング
 * @param samples 入力サンプル
 * @param factor オーバーサンプリング倍率
 * @returns オーバーサンプリングされたサンプル
 */
function linearOversample(samples: Float32Array, factor: number): Float32Array {
  const outputLength = (samples.length - 1) * factor + 1;
  const output = new Float32Array(outputLength);

  for (let i = 0; i < samples.length - 1; i++) {
    const start = ensureValidSample(samples[i] ?? 0);
    const end = ensureValidSample(samples[i + 1] ?? 0);
    const step = (end - start) / factor;

    for (let j = 0; j < factor; j++) {
      output[i * factor + j] = start + step * j;
    }
  }

  // 最後のサンプル
  if (samples.length > 0) {
    output[outputLength - 1] = ensureValidSample(samples[samples.length - 1] ?? 0);
  }

  return output;
}

/**
 * 3次スプライン補間によるオーバーサンプリング
 * @param samples 入力サンプル
 * @param factor オーバーサンプリング倍率
 * @returns オーバーサンプリングされたサンプル
 */
function cubicOversample(samples: Float32Array, factor: number): Float32Array {
  if (samples.length < 4) {
    // 短いサンプルの場合は線形補間にフォールバック
    return linearOversample(samples, factor);
  }

  const outputLength = (samples.length - 1) * factor + 1;
  const output = new Float32Array(outputLength);

  // 3次スプライン補間のための4点を使用
  for (let i = 0; i < samples.length - 1; i++) {
    // 4点を取得（境界処理あり）
    const p0 = ensureValidSample(samples[Math.max(0, i - 1)] ?? 0);
    const p1 = ensureValidSample(samples[i] ?? 0);
    const p2 = ensureValidSample(samples[Math.min(samples.length - 1, i + 1)] ?? 0);
    const p3 = ensureValidSample(samples[Math.min(samples.length - 1, i + 2)] ?? 0);

    for (let j = 0; j < factor; j++) {
      const t = j / factor;
      const t2 = t * t;
      const t3 = t2 * t;

      // Catmull-Rom スプライン
      const value =
        0.5 *
        (2 * p1 +
          (-p0 + p2) * t +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
          (-p0 + 3 * p1 - 3 * p2 + p3) * t3);

      output[i * factor + j] = ensureValidSample(value);
    }
  }

  // 最後のサンプル
  if (samples.length > 0) {
    output[outputLength - 1] = ensureValidSample(samples[samples.length - 1] ?? 0);
  }

  return output;
}

/**
 * sinc補間によるオーバーサンプリング（高品質だが重い）
 * @param samples 入力サンプル
 * @param factor オーバーサンプリング倍率
 * @returns オーバーサンプリングされたサンプル
 */
function sincOversample(samples: Float32Array, factor: number): Float32Array {
  const outputLength = (samples.length - 1) * factor + 1;
  const output = new Float32Array(outputLength);

  // sinc関数（windowed sinc）
  const sincFunction = (x: number): number => {
    if (Math.abs(x) < 1e-10) return 1;
    const pi_x = Math.PI * x;
    // Lanczos window (a=3)
    const lanczos = Math.abs(x) < 3 ? (3 * Math.sin(pi_x / 3) * Math.sin(pi_x)) / (pi_x * pi_x) : 0;
    return lanczos;
  };

  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i / factor;
    let value = 0;

    // 近傍6点での sinc 補間
    for (let j = -3; j <= 3; j++) {
      const sampleIndex = Math.floor(sourceIndex) + j;
      if (sampleIndex >= 0 && sampleIndex < samples.length) {
        const sample = ensureValidSample(samples[sampleIndex] ?? 0);
        const weight = sincFunction(sourceIndex - sampleIndex);
        value += sample * weight;
      }
    }

    output[i] = ensureValidSample(value);
  }

  return output;
}

/**
 * オーバーサンプリングを適用
 * @param samples 入力サンプル
 * @param options オーバーサンプリングオプション
 * @returns オーバーサンプリングされたサンプル
 */
export function oversample(samples: Float32Array, options: OversamplingOptions = {}): Float32Array {
  const { factor = 4, interpolation = 'cubic' } = options;

  // Validate factor is one of the supported values for reliable sinc interpolation
  if (![2, 4, 8].includes(factor)) {
    throw new AudioInspectError(
      'INVALID_INPUT', 
      'オーバーサンプリング係数は2、4、または8である必要があります。他の値ではsinc補間品質が保証されません。'
    );
  }

  if (factor <= 1) {
    return samples;
  }

  if (samples.length === 0) {
    return new Float32Array(0);
  }

  switch (interpolation) {
    case 'linear':
      return linearOversample(samples, factor);
    case 'cubic':
      return cubicOversample(samples, factor);
    case 'sinc':
      return sincOversample(samples, factor);
    default:
      return cubicOversample(samples, factor);
  }
}

/**
 * True Peak検出のためのオーバーサンプリングされたデータからピーク値を検出
 * @param samples 入力サンプル
 * @param options オーバーサンプリングオプション
 * @returns True Peak値
 */
export function getTruePeak(samples: Float32Array, options: OversamplingOptions = {}): number {
  if (samples.length === 0) {
    return 0;
  }

  // オーバーサンプリング適用
  const oversampled = oversample(samples, options);

  // オーバーサンプリングされたデータからピーク値を検出
  let peak = 0;
  for (let i = 0; i < oversampled.length; i++) {
    const sample = Math.abs(ensureValidSample(oversampled[i] ?? 0));
    peak = Math.max(peak, sample);
  }

  return peak;
}
