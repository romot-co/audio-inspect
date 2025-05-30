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
 * スペクトルエントロピーのオプション
 */
export interface SpectralEntropyOptions {
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
}

/**
 * スペクトルエントロピーの結果
 */
export interface SpectralEntropyResult {
  /** スペクトルエントロピー（ビット） */
  entropy: number;
  /** 正規化されたスペクトルエントロピー（0-1） */
  entropyNorm: number;
  /** 使用された周波数範囲 */
  frequencyRange: { min: number; max: number };
}

/**
 * スペクトルクレストファクターのオプション
 */
export interface SpectralCrestOptions {
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
  /** dB値で返すかどうか */
  asDB?: boolean;
}

/**
 * スペクトルクレストファクターの結果
 */
export interface SpectralCrestResult {
  /** スペクトルクレストファクター（線形） */
  crest: number;
  /** スペクトルクレストファクター（dB） */
  crestDB?: number;
  /** ピーク値 */
  peak: number;
  /** 平均値 */
  average: number;
  /** 使用された周波数範囲 */
  frequencyRange: { min: number; max: number };
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
    const prev = ensureValidSample(samples[i - 1] ?? 0);
    const curr = ensureValidSample(samples[i] ?? 0);

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

    // ゼロパディング（フレームサイズがFFTサイズより小さい場合）
    const paddedFrame = new Float32Array(fftSize);
    const copyLength = Math.min(frameData.length, fftSize);
    if (copyLength > 0) {
      paddedFrame.set(frameData.subarray(0, copyLength));
    }

    // フレーム用の音声データを作成
    const frameAudio: AudioData = {
      channelData: [paddedFrame],
      sampleRate: audio.sampleRate,
      numberOfChannels: 1,
      length: fftSize,
      duration: fftSize / audio.sampleRate
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

/**
 * スペクトルエントロピーを計算
 * @param magnitude スペクトル振幅
 * @param minIndex 最小インデックス
 * @param maxIndex 最大インデックス
 * @returns エントロピー値と正規化エントロピー
 */
function calculateSpectralEntropy(
  magnitude: Float32Array,
  minIndex: number,
  maxIndex: number
): { entropy: number; entropyNorm: number } {
  // 指定範囲のパワースペクトルを計算
  const powers = [];
  let totalPower = 0;

  for (let i = minIndex; i <= maxIndex && i < magnitude.length; i++) {
    const mag = magnitude[i];
    if (mag !== undefined) {
      const power = mag * mag;
      powers.push(power);
      totalPower += power;
    }
  }

  if (powers.length === 0 || totalPower <= 1e-10) {
    return { entropy: 0, entropyNorm: 0 };
  }

  // 確率分布に正規化
  const probabilities = powers.map((p) => p / totalPower);

  // エントロピー計算：H = -Σ p_i * log2(p_i)
  let entropy = 0;
  for (const p of probabilities) {
    if (p > 1e-10) {
      // ゼロ除算を防ぐ
      entropy -= p * Math.log2(p);
    }
  }

  // 正規化：H / log2(N)
  const maxEntropy = Math.log2(powers.length);
  const entropyNorm = maxEntropy > 0 ? entropy / maxEntropy : 0;

  return { entropy, entropyNorm };
}

/**
 * スペクトルクレストファクターを計算
 * @param magnitude スペクトル振幅
 * @param minIndex 最小インデックス
 * @param maxIndex 最大インデックス
 * @returns クレストファクター
 */
function calculateSpectralCrest(
  magnitude: Float32Array,
  minIndex: number,
  maxIndex: number
): { crest: number; peak: number; average: number } {
  let peak = 0;
  let sum = 0;
  let count = 0;

  for (let i = minIndex; i <= maxIndex && i < magnitude.length; i++) {
    const mag = magnitude[i];
    if (mag !== undefined) {
      peak = Math.max(peak, mag);
      sum += mag;
      count++;
    }
  }

  if (count === 0) {
    return { crest: 0, peak: 0, average: 0 };
  }

  const average = sum / count;
  const crest = average > 1e-10 ? peak / average : 0;

  return { crest, peak, average };
}

/**
 * スペクトルエントロピーを計算
 * @param audio 音声データ
 * @param options オプション
 * @returns スペクトルエントロピー
 */
export async function getSpectralEntropy(
  audio: AudioData,
  options: SpectralEntropyOptions = {}
): Promise<SpectralEntropyResult> {
  const {
    fftSize = 2048,
    windowFunction = 'hann',
    channel = 0,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2
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

  // スペクトルエントロピーを計算
  const { entropy, entropyNorm } = calculateSpectralEntropy(
    fftResult.magnitude,
    minIndex,
    maxIndex
  );

  return {
    entropy,
    entropyNorm,
    frequencyRange: {
      min: minFrequency,
      max: maxFrequency
    }
  };
}

/**
 * スペクトルクレストファクターを計算
 * @param audio 音声データ
 * @param options オプション
 * @returns スペクトルクレストファクター
 */
export async function getSpectralCrest(
  audio: AudioData,
  options: SpectralCrestOptions = {}
): Promise<SpectralCrestResult> {
  const {
    fftSize = 2048,
    windowFunction = 'hann',
    channel = 0,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    asDB = false
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

  // スペクトルクレストファクターを計算
  const { crest, peak, average } = calculateSpectralCrest(fftResult.magnitude, minIndex, maxIndex);

  const result: SpectralCrestResult = {
    crest,
    peak,
    average,
    frequencyRange: {
      min: minFrequency,
      max: maxFrequency
    }
  };

  if (asDB) {
    result.crestDB = crest > 0 ? 20 * Math.log10(crest) : -Infinity;
  }

  return result;
}

/**
 * MFCCのオプション
 */
export interface MFCCOptions {
  /** フレームサイズ（ミリ秒、デフォルト: 25） */
  frameSizeMs?: number;
  /** ホップサイズ（ミリ秒、デフォルト: 10） */
  hopSizeMs?: number;
  /** FFTサイズ */
  fftSize?: number;
  /** 窓関数 */
  windowFunction?: 'hann' | 'hamming' | 'blackman' | 'none';
  /** 解析するチャンネル */
  channel?: number;
  /** Melフィルタバンクの数（デフォルト: 40） */
  numMelFilters?: number;
  /** MFCC係数の数（デフォルト: 13） */
  numMfccCoeffs?: number;
  /** 最小周波数（Hz、デフォルト: 0） */
  minFrequency?: number;
  /** 最大周波数（Hz、デフォルト: サンプルレート/2） */
  maxFrequency?: number;
  /** プリエンファシス係数（デフォルト: 0.97） */
  preEmphasis?: number;
  /** ログのリフタリング係数（デフォルト: 22） */
  lifterCoeff?: number;
}

/**
 * MFCCの結果
 */
export interface MFCCResult {
  /** MFCC係数（各行が時刻、各列が係数） */
  mfcc: number[][];
  /** 時間軸（秒） */
  times: Float32Array;
  /** フレーム情報 */
  frameInfo: {
    frameSizeMs: number;
    hopSizeMs: number;
    numFrames: number;
    numCoeffs: number;
  };
  /** 使用された周波数範囲 */
  frequencyRange: { min: number; max: number };
}

/**
 * 周波数をMelスケールに変換
 * @param freq 周波数（Hz）
 * @returns Mel値
 */
function hzToMel(freq: number): number {
  return 2595 * Math.log10(1 + freq / 700);
}

/**
 * MelスケールからHzに変換
 * @param mel Mel値
 * @returns 周波数（Hz）
 */
function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

/**
 * Melフィルタバンクを生成
 * @param numFilters フィルタ数
 * @param fftSize FFTサイズ
 * @param sampleRate サンプルレート
 * @param minFreq 最小周波数
 * @param maxFreq 最大周波数
 * @returns フィルタバンク（各行がフィルタ、各列が周波数ビン）
 */
function createMelFilterBank(
  numFilters: number,
  fftSize: number,
  sampleRate: number,
  minFreq: number,
  maxFreq: number
): Float32Array[] {
  const filters: Float32Array[] = [];
  const nyquist = sampleRate / 2;
  const numBins = Math.floor(fftSize / 2) + 1;

  // Melスケールでの等間隔な点を計算
  const minMel = hzToMel(minFreq);
  const maxMel = hzToMel(maxFreq);
  const melPoints = new Array<number>(numFilters + 2);

  for (let i = 0; i < numFilters + 2; i++) {
    melPoints[i] = minMel + ((maxMel - minMel) * i) / (numFilters + 1);
  }

  // MelからHzに戻してFFTビンのインデックスに変換
  const binPoints = melPoints.map((mel) => {
    const freq = melToHz(mel);
    return Math.floor((freq / nyquist) * (numBins - 1));
  });

  // 各フィルタを生成
  for (let i = 1; i <= numFilters; i++) {
    const filter = new Float32Array(numBins);
    const left = binPoints[i - 1];
    const center = binPoints[i];
    const right = binPoints[i + 1];

    // 安全チェック
    if (left === undefined || center === undefined || right === undefined) {
      continue;
    }

    // 三角フィルタの作成
    for (let j = left; j <= right; j++) {
      if (j < 0 || j >= numBins || j >= filter.length) continue; // 境界チェック

      if (j < center) {
        // 左の傾斜
        if (center - left > 0) {
          filter[j] = (j - left) / (center - left);
        }
      } else {
        // 右の傾斜
        if (right - center > 0) {
          filter[j] = (right - j) / (right - center);
        }
      }
    }

    filters.push(filter);
  }

  return filters;
}

/**
 * 離散コサイン変換（DCT-II）
 * @param input 入力配列
 * @param numCoeffs 出力係数数
 * @returns DCT係数
 */
function dct(input: number[], numCoeffs: number): number[] {
  const N = input.length;
  const output = new Array<number>(numCoeffs);

  for (let k = 0; k < numCoeffs; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      const inputValue = input[n];
      if (inputValue !== undefined) {
        sum += inputValue * Math.cos((Math.PI * k * (n + 0.5)) / N);
      }
    }

    // 正規化係数
    const norm = k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    output[k] = sum * norm;
  }

  return output;
}

/**
 * プリエンファシスフィルタを適用
 * @param samples 入力サンプル
 * @param coeff プリエンファシス係数
 * @returns フィルタ適用済みサンプル
 */
function applyPreEmphasis(samples: Float32Array, coeff: number): Float32Array {
  const output = new Float32Array(samples.length);
  output[0] = ensureValidSample(samples[0] ?? 0);

  for (let i = 1; i < samples.length; i++) {
    const current = ensureValidSample(samples[i] ?? 0);
    const previous = ensureValidSample(samples[i - 1] ?? 0);
    output[i] = current - coeff * previous;
  }

  return output;
}

/**
 * リフタリング（ケプストラム領域での畳み込み）
 * @param mfcc MFCC係数
 * @param lifterCoeff リフタリング係数
 * @returns リフタリング適用済みMFCC
 */
function applyLiftering(mfcc: number[], lifterCoeff: number): number[] {
  return mfcc.map((coeff, index) => {
    if (lifterCoeff === 0) return coeff;
    const lifter = 1 + (lifterCoeff / 2) * Math.sin((Math.PI * index) / lifterCoeff);
    return coeff * lifter;
  });
}

/**
 * ハミング窓を適用
 * @param frame フレームデータ
 * @returns 窓適用済みフレーム
 */
function applyHammingWindow(frame: Float32Array): Float32Array {
  const windowed = new Float32Array(frame.length);
  const N = frame.length;

  for (let i = 0; i < N; i++) {
    const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1));
    windowed[i] = ensureValidSample(frame[i] ?? 0) * window;
  }

  return windowed;
}

/**
 * MFCC（Mel-Frequency Cepstral Coefficients）を計算
 * @param audio 音声データ
 * @param options オプション
 * @returns MFCC
 */
export async function getMFCC(audio: AudioData, options: MFCCOptions = {}): Promise<MFCCResult> {
  const {
    frameSizeMs = 25,
    hopSizeMs = 10,
    fftSize = 512,
    windowFunction = 'hamming',
    channel = 0,
    numMelFilters = 40,
    numMfccCoeffs = 13,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    preEmphasis = 0.97,
    lifterCoeff = 22
  } = options;

  if (channel >= audio.numberOfChannels) {
    throw new AudioInspectError('INVALID_INPUT', `無効なチャンネル番号: ${channel}`);
  }

  // フレームサイズとホップサイズをサンプル数に変換
  const frameSizeSamples = Math.floor((frameSizeMs / 1000) * audio.sampleRate);
  const hopSizeSamples = Math.floor((hopSizeMs / 1000) * audio.sampleRate);

  if (frameSizeSamples <= 0 || hopSizeSamples <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'フレームサイズまたはホップサイズが小さすぎます');
  }

  const samples = audio.channelData[channel];
  if (!samples) {
    throw new AudioInspectError('INVALID_INPUT', `チャンネル ${channel} のデータが存在しません`);
  }

  // プリエンファシス適用
  const emphasizedSamples = applyPreEmphasis(samples, preEmphasis);

  // フレーム数を計算
  const numFrames = Math.floor((emphasizedSamples.length - frameSizeSamples) / hopSizeSamples) + 1;

  if (numFrames <= 0) {
    throw new AudioInspectError('INSUFFICIENT_DATA', 'フレーム数が不正です');
  }

  // Melフィルタバンクを生成
  const melFilters = createMelFilterBank(
    numMelFilters,
    fftSize,
    audio.sampleRate,
    minFrequency,
    maxFrequency
  );

  const mfccData: number[][] = [];
  const times = new Float32Array(numFrames);

  // フレームごとの処理
  for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
    const startSample = frameIndex * hopSizeSamples;
    times[frameIndex] = startSample / audio.sampleRate;

    // フレームデータの抽出
    const frameData = emphasizedSamples.subarray(startSample, startSample + frameSizeSamples);

    // ゼロパディング（フレームサイズがFFTサイズより小さい場合）
    const paddedFrame = new Float32Array(fftSize);
    const copyLength = Math.min(frameData.length, fftSize);
    if (copyLength > 0) {
      paddedFrame.set(frameData.subarray(0, copyLength));
    }

    // 窓関数適用
    const windowedFrame =
      windowFunction === 'hamming' ? applyHammingWindow(paddedFrame) : paddedFrame;

    // フレーム用の音声データを作成してFFT解析
    const frameAudio: AudioData = {
      channelData: [windowedFrame],
      sampleRate: audio.sampleRate,
      numberOfChannels: 1,
      length: fftSize,
      duration: fftSize / audio.sampleRate
    };

    const fftResult = await getFFT(frameAudio, {
      fftSize,
      windowFunction: 'none', // 既に窓関数適用済み
      channel: 0
    });

    // パワースペクトルを計算
    const powerSpectrum = new Array<number>(fftResult.magnitude.length);
    for (let i = 0; i < fftResult.magnitude.length; i++) {
      const mag = fftResult.magnitude[i] ?? 0;
      powerSpectrum[i] = mag * mag;
    }

    // Melフィルタバンクを適用
    const melSpectrum = new Array<number>(numMelFilters);
    for (let i = 0; i < numMelFilters; i++) {
      let sum = 0;
      const filter = melFilters[i];
      if (filter) {
        for (let j = 0; j < filter.length && j < powerSpectrum.length; j++) {
          sum += (powerSpectrum[j] ?? 0) * (filter[j] ?? 0);
        }
      }
      melSpectrum[i] = Math.max(sum, 1e-10); // ログ計算のための最小値
    }

    // 対数変換
    const logMelSpectrum = melSpectrum.map((value) => Math.log(value));

    // DCT変換でMFCC係数を計算
    const mfccCoeffs = dct(logMelSpectrum, numMfccCoeffs);

    // リフタリング適用
    const lifteredMfcc = applyLiftering(mfccCoeffs, lifterCoeff);

    mfccData.push(lifteredMfcc);
  }

  return {
    mfcc: mfccData,
    times,
    frameInfo: {
      frameSizeMs,
      hopSizeMs,
      numFrames,
      numCoeffs: numMfccCoeffs
    },
    frequencyRange: {
      min: minFrequency,
      max: maxFrequency
    }
  };
}

/**
 * デルタ係数とデルタデルタ係数の計算
 * @param coefficients MFCC係数の配列
 * @param windowSize 計算に使用する窓サイズ（デフォルト: 2）
 * @returns デルタ係数とデルタデルタ係数
 */
export function computeDeltaCoefficients(
  coefficients: number[][],
  windowSize: number = 2
): { delta: number[][]; deltaDelta: number[][] } {
  const numFrames = coefficients.length;
  const numCoeffs = coefficients[0]?.length || 0;

  const delta: number[][] = [];
  const deltaDelta: number[][] = [];

  // デルタ係数の計算
  for (let i = 0; i < numFrames; i++) {
    const deltaFrame: number[] = [];

    for (let j = 0; j < numCoeffs; j++) {
      let numerator = 0;
      let denominator = 0;

      for (let k = -windowSize; k <= windowSize; k++) {
        const idx = Math.max(0, Math.min(numFrames - 1, i + k));
        const coeff = coefficients[idx]?.[j] || 0;
        numerator += k * coeff;
        denominator += k * k;
      }

      deltaFrame[j] = denominator > 0 ? numerator / denominator : 0;
    }

    delta.push(deltaFrame);
  }

  // デルタデルタ係数の計算
  for (let i = 0; i < numFrames; i++) {
    const deltaDeltaFrame: number[] = [];

    for (let j = 0; j < numCoeffs; j++) {
      let numerator = 0;
      let denominator = 0;

      for (let k = -windowSize; k <= windowSize; k++) {
        const idx = Math.max(0, Math.min(numFrames - 1, i + k));
        const deltaCoeff = delta[idx]?.[j] || 0;
        numerator += k * deltaCoeff;
        denominator += k * k;
      }

      deltaDeltaFrame[j] = denominator > 0 ? numerator / denominator : 0;
    }

    deltaDelta.push(deltaDeltaFrame);
  }

  return { delta, deltaDelta };
}

/**
 * MFCCデルタ係数の拡張オプション
 */
export interface MFCCDeltaOptions extends MFCCOptions {
  /** デルタ係数計算の窓サイズ（デフォルト: 2） */
  deltaWindowSize?: number;
  /** デルタ係数を計算するかどうか */
  computeDelta?: boolean;
  /** デルタデルタ係数を計算するかどうか */
  computeDeltaDelta?: boolean;
}

/**
 * MFCCデルタ係数の拡張結果
 */
export interface MFCCDeltaResult extends MFCCResult {
  /** デルタ係数（計算された場合） */
  delta?: number[][];
  /** デルタデルタ係数（計算された場合） */
  deltaDelta?: number[][];
}

/**
 * AudioDataからMFCCとデルタ係数を統合計算
 * @param audio 音声データ
 * @param options オプション
 * @returns MFCC、デルタ係数、デルタデルタ係数
 */
export async function getMFCCWithDelta(
  audio: AudioData,
  options: MFCCDeltaOptions = {}
): Promise<MFCCDeltaResult> {
  const {
    deltaWindowSize = 2,
    computeDelta = true,
    computeDeltaDelta = true,
    ...mfccOptions
  } = options;

  // MFCC計算
  const mfccResult = await getMFCC(audio, mfccOptions);

  const result: MFCCDeltaResult = { ...mfccResult };

  // デルタ係数計算
  if (computeDelta || computeDeltaDelta) {
    const deltaCoeffs = computeDeltaCoefficients(mfccResult.mfcc, deltaWindowSize);

    if (computeDelta) {
      result.delta = deltaCoeffs.delta;
    }

    if (computeDeltaDelta) {
      result.deltaDelta = deltaCoeffs.deltaDelta;
    }
  }

  return result;
}
