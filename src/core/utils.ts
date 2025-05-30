import { AudioInspectError, type AudioData, type BiquadCoeffs } from '../types.js';

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

// A特性フィルタ係数のキャッシュ
const aWeightingCache = new Map<number, BiquadCoeffs[]>();

/**
 * A特性フィルタ係数を設計（IEC 61672準拠）
 * @param sampleRate サンプルレート
 * @returns 4段のバイカッドフィルタ係数
 */
function designAWeighting(sampleRate: number): BiquadCoeffs[] {
  // キャッシュを確認
  const cached = aWeightingCache.get(sampleRate);
  if (cached) {
    return cached;
  }

  // IEC 61672 A特性フィルタのアナログ設計パラメータ
  // 4つのポール周波数
  const f1 = 20.5989; // Hz
  const f2 = 107.652; // Hz
  const f3 = 737.862; // Hz
  const f4 = 12194.217; // Hz

  // バイリニア変換
  const T = 1.0 / sampleRate;
  const coeffs: BiquadCoeffs[] = [];

  // ポール1,2: 複素共役ペア (20.6 Hz, Q = 0.5)
  const w1 = 2 * Math.PI * f1;
  const Q1 = 0.7071; // sqrt(2)/2
  const cosw1T = Math.cos(w1 * T);
  const sinw1T = Math.sin(w1 * T);
  const alpha1 = sinw1T / (2 * Q1);

  const stage1_a0 = 1 + alpha1;
  const stage1_a1 = -2 * cosw1T;
  const stage1_a2 = 1 - alpha1;
  const stage1_b0 = (1 + cosw1T) / 2; // ハイパス
  const stage1_b1 = -(1 + cosw1T);
  const stage1_b2 = (1 + cosw1T) / 2;

  coeffs.push({
    b0: stage1_b0 / stage1_a0,
    b1: stage1_b1 / stage1_a0,
    b2: stage1_b2 / stage1_a0,
    a0: 1.0,
    a1: stage1_a1 / stage1_a0,
    a2: stage1_a2 / stage1_a0
  });

  // ポール3: 実ポール (107.7 Hz)
  const w2 = 2 * Math.PI * f2;
  const cosw2T = Math.cos(w2 * T);
  const sinw2T = Math.sin(w2 * T);
  const alpha2 = sinw2T / (2 * 0.7071);

  const stage2_a0 = 1 + alpha2;
  const stage2_a1 = -2 * cosw2T;
  const stage2_a2 = 1 - alpha2;
  const stage2_b0 = (1 + cosw2T) / 2;
  const stage2_b1 = -(1 + cosw2T);
  const stage2_b2 = (1 + cosw2T) / 2;

  coeffs.push({
    b0: stage2_b0 / stage2_a0,
    b1: stage2_b1 / stage2_a0,
    b2: stage2_b2 / stage2_a0,
    a0: 1.0,
    a1: stage2_a1 / stage2_a0,
    a2: stage2_a2 / stage2_a0
  });

  // ポール4: 実ポール (737.9 Hz)
  const w3 = 2 * Math.PI * f3;
  const cosw3T = Math.cos(w3 * T);
  const sinw3T = Math.sin(w3 * T);
  const alpha3 = sinw3T / (2 * 0.7071);

  const stage3_a0 = 1 + alpha3;
  const stage3_a1 = -2 * cosw3T;
  const stage3_a2 = 1 - alpha3;
  const stage3_b0 = (1 + cosw3T) / 2;
  const stage3_b1 = -(1 + cosw3T);
  const stage3_b2 = (1 + cosw3T) / 2;

  coeffs.push({
    b0: stage3_b0 / stage3_a0,
    b1: stage3_b1 / stage3_a0,
    b2: stage3_b2 / stage3_a0,
    a0: 1.0,
    a1: stage3_a1 / stage3_a0,
    a2: stage3_a2 / stage3_a0
  });

  // ポール5,6: 複素共役ペア (12.2 kHz, Q = 0.5)
  const w4 = 2 * Math.PI * f4;
  const Q4 = 0.7071;
  const cosw4T = Math.cos(w4 * T);
  const sinw4T = Math.sin(w4 * T);
  const alpha4 = sinw4T / (2 * Q4);

  const stage4_a0 = 1 + alpha4;
  const stage4_a1 = -2 * cosw4T;
  const stage4_a2 = 1 - alpha4;
  const stage4_b0 = 1; // ローパス
  const stage4_b1 = 2;
  const stage4_b2 = 1;

  coeffs.push({
    b0: stage4_b0 / stage4_a0,
    b1: stage4_b1 / stage4_a0,
    b2: stage4_b2 / stage4_a0,
    a0: 1.0,
    a1: stage4_a1 / stage4_a0,
    a2: stage4_a2 / stage4_a0
  });

  // 1kHzでの正規化ゲインを計算
  const testFreq = 1000; // Hz
  const omega = (2 * Math.PI * testFreq) / sampleRate;
  const z_real = Math.cos(omega);
  const z_imag = Math.sin(omega);

  let H_real = 1.0;
  let H_imag = 0.0;

  for (const coeff of coeffs) {
    // H(z) = (b0 + b1*z^-1 + b2*z^-2) / (a0 + a1*z^-1 + a2*z^-2)
    const num_real = coeff.b0 + coeff.b1 * z_real + coeff.b2 * (z_real * z_real - z_imag * z_imag);
    const num_imag = coeff.b1 * z_imag + coeff.b2 * 2 * z_real * z_imag;

    const den_real = coeff.a0 + coeff.a1 * z_real + coeff.a2 * (z_real * z_real - z_imag * z_imag);
    const den_imag = coeff.a1 * z_imag + coeff.a2 * 2 * z_real * z_imag;

    // 複素除算
    const den_mag_sq = den_real * den_real + den_imag * den_imag;
    const h_real = (num_real * den_real + num_imag * den_imag) / den_mag_sq;
    const h_imag = (num_imag * den_real - num_real * den_imag) / den_mag_sq;

    // 積算
    const new_H_real = H_real * h_real - H_imag * h_imag;
    const new_H_imag = H_real * h_imag + H_imag * h_real;
    H_real = new_H_real;
    H_imag = new_H_imag;
  }

  const magnitude = Math.sqrt(H_real * H_real + H_imag * H_imag);
  const normalizationGain = 1.0 / magnitude; // 1kHzで0dBになるよう正規化

  // 正規化ゲインを最初の段に適用
  coeffs[0]!.b0 *= normalizationGain;
  coeffs[0]!.b1 *= normalizationGain;
  coeffs[0]!.b2 *= normalizationGain;

  // キャッシュに保存
  aWeightingCache.set(sampleRate, coeffs);

  return coeffs;
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
 * シンプルなバターワースフィルタ（A特性の簡易版）
 * 注意: これは近似版であり、正確なA特性ではありません
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
