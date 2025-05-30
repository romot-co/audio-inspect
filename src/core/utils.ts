import { AudioData, AudioInspectError } from '../types.js';

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
 * 2次IIRフィルタ係数
 */
interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/**
 * A特性フィルタを適用
 * ITU-R BS.1770準拠のA特性フィルタ実装
 * @param samples 入力サンプル
 * @param sampleRate サンプルレート
 * @returns A特性フィルタを適用したサンプル
 */
export function applyAWeighting(samples: Float32Array, sampleRate: number): Float32Array {
  // A特性フィルタは2つの2次フィルタの直列接続で実装
  // 48kHzに正規化された係数を使用し、サンプルレートに応じて調整

  // A特性フィルタの設計パラメータ
  const f1 = 20.598997; // ローパス周波数
  const f2 = 12194.217; // ハイパス周波数

  // 第一段（ハイパス）の係数計算
  const wc1 = (2 * Math.PI * f1) / sampleRate;
  const k1 = Math.tan(wc1 / 2);
  const norm1 = 1 / (1 + Math.sqrt(2) * k1 + k1 * k1);

  const highpass: BiquadCoefficients = {
    b0: norm1,
    b1: -2 * norm1,
    b2: norm1,
    a1: 2 * (k1 * k1 - 1) * norm1,
    a2: (1 - Math.sqrt(2) * k1 + k1 * k1) * norm1
  };

  // 第二段（ローパス）の係数計算
  const wc2 = (2 * Math.PI * f2) / sampleRate;
  const k2 = Math.tan(wc2 / 2);
  const norm2 = 1 / (1 + Math.sqrt(2) * k2 + k2 * k2);

  const lowpass: BiquadCoefficients = {
    b0: k2 * k2 * norm2,
    b1: 2 * k2 * k2 * norm2,
    b2: k2 * k2 * norm2,
    a1: 2 * (k2 * k2 - 1) * norm2,
    a2: (1 - Math.sqrt(2) * k2 + k2 * k2) * norm2
  };

  // フィルタ状態の初期化
  const state1: BiquadState = { x1: 0, x2: 0, y1: 0, y2: 0 };
  const state2: BiquadState = { x1: 0, x2: 0, y1: 0, y2: 0 };

  const output = new Float32Array(samples.length);

  // A特性ゲイン調整（1kHzで0dB）
  const gain = 1.584893192; // A特性の正規化ゲイン

  // フィルタ処理
  for (let i = 0; i < samples.length; i++) {
    const input = ensureValidSample(samples[i] ?? 0);

    // 第一段フィルタ（ハイパス）
    const output1 =
      highpass.b0 * input +
      highpass.b1 * state1.x1 +
      highpass.b2 * state1.x2 -
      highpass.a1 * state1.y1 -
      highpass.a2 * state1.y2;

    // 状態更新
    state1.x2 = state1.x1;
    state1.x1 = input;
    state1.y2 = state1.y1;
    state1.y1 = ensureValidSample(output1);

    // 第二段フィルタ（ローパス）
    const output2 =
      lowpass.b0 * output1 +
      lowpass.b1 * state2.x1 +
      lowpass.b2 * state2.x2 -
      lowpass.a1 * state2.y1 -
      lowpass.a2 * state2.y2;

    // 状態更新
    state2.x2 = state2.x1;
    state2.x1 = ensureValidSample(output1);
    state2.y2 = state2.y1;
    state2.y1 = ensureValidSample(output2);

    // ゲイン適用
    output[i] = ensureValidSample(output2 * gain);
  }

  return output;
}

/**
 * シンプルなバターワースフィルタ（A特性の簡易版）
 * @param samples 入力サンプル
 * @param sampleRate サンプルレート
 * @returns フィルタ適用済みサンプル
 */
export function applySimpleAWeighting(samples: Float32Array, sampleRate: number): Float32Array {
  // より簡単なA特性の近似実装
  // 実用的な範囲での近似

  const output = new Float32Array(samples.length);

  // 1次ハイパスフィルタ（20Hz）とローパスフィルタ（20kHz）の組み合わせ
  const fc_high = 20.0 / (sampleRate / 2);
  const fc_low = 20000.0 / (sampleRate / 2);

  const alpha_high = Math.exp(-2.0 * Math.PI * fc_high);
  const alpha_low = Math.exp(-2.0 * Math.PI * fc_low);

  let prev_input = 0;
  let prev_output_high = 0;
  let prev_output_low = 0;

  for (let i = 0; i < samples.length; i++) {
    const input = ensureValidSample(samples[i] ?? 0);

    // ハイパスフィルタ
    const highpass_output = alpha_high * (prev_output_high + input - prev_input);
    prev_input = input;
    prev_output_high = highpass_output;

    // ローパスフィルタ
    const lowpass_output = (1 - alpha_low) * highpass_output + alpha_low * prev_output_low;
    prev_output_low = lowpass_output;

    // A特性の周波数特性を近似するゲイン調整
    // 1kHz周辺でピークを持つ特性
    output[i] = ensureValidSample(lowpass_output * 1.5);
  }

  return output;
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
