import { AudioData, AudioInspectError } from '../types';
import { ensureValidSample } from '../core/utils';
import { getFFT } from './frequency';

/**
 * スペクトル特徴量のオプション
 */
export interface SpectralFeaturesOptions {
  /** FFTサイズ */
  fftSize?: number;
  /** 窓関数 */
  windowFunction?: 'hann' | 'hamming' | 'blackman' | 'none';
  /** 解析するチャンネル */
  channel?: number;
  /** 最小周波数 */
  minFrequency?: number;
  /** 最大周波数 */
  maxFrequency?: number;
  /** スペクトルロールオフの閾値（0-1） */
  rolloffThreshold?: number;
}

/**
 * スペクトル特徴量の結果
 */
export interface SpectralFeaturesResult {
  /** スペクトル重心（Hz） */
  spectralCentroid: number;
  /** スペクトル帯域幅（Hz） */
  spectralBandwidth: number;
  /** スペクトルロールオフ（Hz） */
  spectralRolloff: number;
  /** スペクトルフラットネス（0-1） */
  spectralFlatness: number;
  /** スペクトルフラックス */
  spectralFlux?: number;
  /** ゼロ交差率 */
  zeroCrossingRate: number;
  /** 使用された周波数範囲 */
  frequencyRange: { min: number; max: number };
}

/**
 * 時系列スペクトル特徴量のオプション
 */
export interface TimeVaryingSpectralOptions extends SpectralFeaturesOptions {
  /** フレームサイズ */
  frameSize?: number;
  /** ホップサイズ */
  hopSize?: number;
  /** フレーム数（指定しない場合は全体を解析） */
  numFrames?: number;
}

/**
 * 時系列スペクトル特徴量の結果
 */
export interface TimeVaryingSpectralResult {
  /** 時間軸（秒） */
  times: Float32Array;
  /** スペクトル重心の時系列 */
  spectralCentroid: Float32Array;
  /** スペクトル帯域幅の時系列 */
  spectralBandwidth: Float32Array;
  /** スペクトルロールオフの時系列 */
  spectralRolloff: Float32Array;
  /** スペクトルフラットネスの時系列 */
  spectralFlatness: Float32Array;
  /** スペクトルフラックスの時系列 */
  spectralFlux: Float32Array;
  /** ゼロ交差率の時系列 */
  zeroCrossingRate: Float32Array;
  /** フレーム情報 */
  frameInfo: {
    frameSize: number;
    hopSize: number;
    numFrames: number;
  };
}

/**
 * スペクトル重心を計算
 * @param magnitude スペクトル振幅
 * @param frequencies 周波数配列
 * @param minFreq 最小周波数
 * @param maxFreq 最大周波数
 * @returns スペクトル重心（Hz）
 */
function calculateSpectralCentroid(
  magnitude: Float32Array,
  frequencies: Float32Array,
  minFreq: number,
  maxFreq: number
): number {
  let weightedSum = 0;
  let magnitudeSum = 0;

  for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
    const freq = frequencies[i];
    const mag = magnitude[i];
    if (freq !== undefined && mag !== undefined && freq >= minFreq && freq <= maxFreq) {
      weightedSum += freq * mag;
      magnitudeSum += mag;
    }
  }

  return magnitudeSum > 1e-10 ? weightedSum / magnitudeSum : 0;
}

/**
 * スペクトル帯域幅を計算
 * @param magnitude スペクトル振幅
 * @param frequencies 周波数配列
 * @param centroid スペクトル重心
 * @param minFreq 最小周波数
 * @param maxFreq 最大周波数
 * @returns スペクトル帯域幅（Hz）
 */
function calculateSpectralBandwidth(
  magnitude: Float32Array,
  frequencies: Float32Array,
  centroid: number,
  minFreq: number,
  maxFreq: number
): number {
  let weightedVarianceSum = 0;
  let magnitudeSum = 0;

  for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
    const freq = frequencies[i];
    const mag = magnitude[i];
    if (freq !== undefined && mag !== undefined && freq >= minFreq && freq <= maxFreq) {
      const deviation = freq - centroid;
      weightedVarianceSum += deviation * deviation * mag;
      magnitudeSum += mag;
    }
  }

  return magnitudeSum > 1e-10 ? Math.sqrt(weightedVarianceSum / magnitudeSum) : 0;
}

/**
 * スペクトルロールオフを計算
 * @param magnitude スペクトル振幅
 * @param frequencies 周波数配列
 * @param threshold 閾値（0-1）
 * @param minFreq 最小周波数
 * @param maxFreq 最大周波数
 * @returns スペクトルロールオフ（Hz）
 */
function calculateSpectralRolloff(
  magnitude: Float32Array,
  frequencies: Float32Array,
  threshold: number,
  minFreq: number,
  maxFreq: number
): number {
  // 指定範囲内の総エネルギーを計算
  let totalEnergy = 0;
  for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
    const freq = frequencies[i];
    const mag = magnitude[i];
    if (freq !== undefined && mag !== undefined && freq >= minFreq && freq <= maxFreq) {
      totalEnergy += mag * mag;
    }
  }

  const targetEnergy = totalEnergy * threshold;
  let cumulativeEnergy = 0;

  for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
    const freq = frequencies[i];
    const mag = magnitude[i];
    if (freq !== undefined && mag !== undefined && freq >= minFreq && freq <= maxFreq) {
      cumulativeEnergy += mag * mag;
      if (cumulativeEnergy >= targetEnergy) {
        return freq;
      }
    }
  }

  return maxFreq;
}

/**
 * スペクトルフラットネスを計算
 * @param magnitude スペクトル振幅
 * @param minIndex 最小インデックス
 * @param maxIndex 最大インデックス
 * @returns スペクトルフラットネス（0-1）
 */
function calculateSpectralFlatness(
  magnitude: Float32Array,
  minIndex: number,
  maxIndex: number
): number {
  let geometricMean = 0;
  let arithmeticMean = 0;
  let count = 0;

  for (let i = minIndex; i <= maxIndex && i < magnitude.length; i++) {
    const mag = magnitude[i];
    if (mag !== undefined) {
      const safeMag = Math.max(mag, 1e-10); // ゼロ除算を防ぐ
      geometricMean += Math.log(safeMag);
      arithmeticMean += safeMag;
      count++;
    }
  }

  if (count === 0) return 0;

  geometricMean = Math.exp(geometricMean / count);
  arithmeticMean = arithmeticMean / count;

  return arithmeticMean > 1e-10 ? geometricMean / arithmeticMean : 0;
}

/**
 * ゼロ交差率を計算
 * @param samples 音声サンプル
 * @returns ゼロ交差率
 */
function calculateZeroCrossingRate(samples: Float32Array): number {
  if (samples.length < 2) return 0;

  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = ensureValidSample(samples[i - 1]);
    const curr = ensureValidSample(samples[i]);

    if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
      crossings++;
    }
  }

  return crossings / (samples.length - 1);
}

/**
 * スペクトルフラックスを計算
 * @param currentMagnitude 現在のフレームのスペクトル振幅
 * @param previousMagnitude 前のフレームのスペクトル振幅
 * @returns スペクトルフラックス
 */
function calculateSpectralFlux(
  currentMagnitude: Float32Array,
  previousMagnitude?: Float32Array
): number {
  if (!previousMagnitude) return 0;

  let flux = 0;
  const length = Math.min(currentMagnitude.length, previousMagnitude.length);

  for (let i = 0; i < length; i++) {
    const current = currentMagnitude[i];
    const previous = previousMagnitude[i];
    if (current !== undefined && previous !== undefined) {
      const diff = current - previous;
      flux += diff * diff;
    }
  }

  return Math.sqrt(flux / length);
}

/**
 * 単一フレームのスペクトル特徴量を計算
 * @param audio 音声データ
 * @param options オプション
 * @returns スペクトル特徴量
 */
export async function getSpectralFeatures(
  audio: AudioData,
  options: SpectralFeaturesOptions = {}
): Promise<SpectralFeaturesResult> {
  const {
    fftSize = 2048,
    windowFunction = 'hann',
    channel = 0,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    rolloffThreshold = 0.85
  } = options;

  if (channel >= audio.numberOfChannels) {
    throw new AudioInspectError('INVALID_INPUT', `無効なチャンネル番号: ${channel}`);
  }

  // FFT解析
  const fftResult = await getFFT(audio, {
    fftSize,
    windowFunction,
    channel
  });

  // 周波数範囲のインデックスを計算
  const minIndex = Math.max(0, Math.floor((minFrequency * fftSize) / audio.sampleRate));
  const maxIndex = Math.min(
    fftResult.frequencies.length - 1,
    Math.floor((maxFrequency * fftSize) / audio.sampleRate)
  );

  // スペクトル重心
  const spectralCentroid = calculateSpectralCentroid(
    fftResult.magnitude,
    fftResult.frequencies,
    minFrequency,
    maxFrequency
  );

  // スペクトル帯域幅
  const spectralBandwidth = calculateSpectralBandwidth(
    fftResult.magnitude,
    fftResult.frequencies,
    spectralCentroid,
    minFrequency,
    maxFrequency
  );

  // スペクトルロールオフ
  const spectralRolloff = calculateSpectralRolloff(
    fftResult.magnitude,
    fftResult.frequencies,
    rolloffThreshold,
    minFrequency,
    maxFrequency
  );

  // スペクトルフラットネス
  const spectralFlatness = calculateSpectralFlatness(fftResult.magnitude, minIndex, maxIndex);

  // ゼロ交差率
  const samples = audio.channelData[channel];
  if (!samples) {
    throw new AudioInspectError('INVALID_INPUT', `チャンネル ${channel} のデータが存在しません`);
  }
  const zeroCrossingRate = calculateZeroCrossingRate(samples);

  return {
    spectralCentroid,
    spectralBandwidth,
    spectralRolloff,
    spectralFlatness,
    zeroCrossingRate,
    frequencyRange: {
      min: minFrequency,
      max: maxFrequency
    }
  };
}

/**
 * 時系列スペクトル特徴量を計算
 * @param audio 音声データ
 * @param options オプション
 * @returns 時系列スペクトル特徴量
 */
export async function getTimeVaryingSpectralFeatures(
  audio: AudioData,
  options: TimeVaryingSpectralOptions = {}
): Promise<TimeVaryingSpectralResult> {
  const {
    frameSize = 2048,
    hopSize = frameSize / 2,
    fftSize = frameSize,
    windowFunction = 'hann',
    channel = 0,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    rolloffThreshold = 0.85,
    numFrames
  } = options;

  if (channel >= audio.numberOfChannels) {
    throw new AudioInspectError('INVALID_INPUT', `無効なチャンネル番号: ${channel}`);
  }

  const samples = audio.channelData[channel];
  if (!samples) {
    throw new AudioInspectError('INVALID_INPUT', `チャンネル ${channel} のデータが存在しません`);
  }

  const totalFrames = numFrames || Math.floor((samples.length - frameSize) / hopSize) + 1;

  if (totalFrames <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'フレーム数が不正です');
  }

  // 結果配列の初期化
  const times = new Float32Array(totalFrames);
  const spectralCentroid = new Float32Array(totalFrames);
  const spectralBandwidth = new Float32Array(totalFrames);
  const spectralRolloff = new Float32Array(totalFrames);
  const spectralFlatness = new Float32Array(totalFrames);
  const spectralFlux = new Float32Array(totalFrames);
  const zeroCrossingRate = new Float32Array(totalFrames);

  let previousMagnitude: Float32Array | undefined;

  // フレームごとの解析
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const startSample = frameIndex * hopSize;
    const endSample = Math.min(startSample + frameSize, samples.length);

    // 時間位置
    times[frameIndex] = startSample / audio.sampleRate;

    // フレームデータの抽出
    const frameData = samples.subarray(startSample, endSample);

    // 短いフレームの場合はゼロパディング
    const paddedFrame = new Float32Array(frameSize);
    paddedFrame.set(frameData);

    // フレーム用の音声データを作成
    const frameAudio: AudioData = {
      channelData: [paddedFrame],
      sampleRate: audio.sampleRate,
      numberOfChannels: 1,
      length: frameSize,
      duration: frameSize / audio.sampleRate
    };

    // スペクトル特徴量を計算
    const features = await getSpectralFeatures(frameAudio, {
      fftSize,
      windowFunction,
      channel: 0,
      minFrequency,
      maxFrequency,
      rolloffThreshold
    });

    spectralCentroid[frameIndex] = features.spectralCentroid;
    spectralBandwidth[frameIndex] = features.spectralBandwidth;
    spectralRolloff[frameIndex] = features.spectralRolloff;
    spectralFlatness[frameIndex] = features.spectralFlatness;
    zeroCrossingRate[frameIndex] = features.zeroCrossingRate;

    // スペクトルフラックスの計算（前フレームとの比較）
    const fftResult = await getFFT(frameAudio, { fftSize, windowFunction, channel: 0 });
    spectralFlux[frameIndex] = calculateSpectralFlux(fftResult.magnitude, previousMagnitude);
    previousMagnitude = new Float32Array(fftResult.magnitude);
  }

  return {
    times,
    spectralCentroid,
    spectralBandwidth,
    spectralRolloff,
    spectralFlatness,
    spectralFlux,
    zeroCrossingRate,
    frameInfo: {
      frameSize,
      hopSize,
      numFrames: totalFrames
    }
  };
}
