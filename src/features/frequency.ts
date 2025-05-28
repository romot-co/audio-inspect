import { AudioData, AudioInspectError } from '../types.js';
import { FFTProviderFactory, FFTProviderType, IFFTProvider, FFTResult } from '../core/fft-provider.js';

/**
 * FFT分析のオプション
 */
export interface FFTOptions {
  /** FFTサイズ（デフォルト: 2048、2の累乗である必要があります） */
  fftSize?: number;
  /** ウィンドウ関数（デフォルト: 'hann'） */
  windowFunction?: 'hann' | 'hamming' | 'blackman' | 'none';
  /** オーバーラップ率（デフォルト: 0.5） */
  overlap?: number;
  /** 解析するチャンネル（デフォルト: 0、-1で全チャンネルの平均） */
  channel?: number;
  /** FFTプロバイダー（デフォルト: 'webfft'） */
  provider?: FFTProviderType;
  /** プロファイリングを有効にする（WebFFTのみ） */
  enableProfiling?: boolean;
}

/**
 * スペクトラム解析のオプション
 */
export interface SpectrumOptions extends FFTOptions {
  /** 最小周波数（Hz、デフォルト: 0） */
  minFrequency?: number;
  /** 最大周波数（Hz、デフォルト: ナイキスト周波数） */
  maxFrequency?: number;
  /** dB表示かどうか（デフォルト: true） */
  decibels?: boolean;
  /** 時間フレーム数（スペクトログラム用、デフォルト: 100） */
  timeFrames?: number;
}

/**
 * スペクトログラムデータ
 */
export interface SpectrogramData {
  /** 時間軸（秒） */
  times: Float32Array;
  /** 周波数軸（Hz） */
  frequencies: Float32Array;
  /** 強度データ（時間 x 周波数） */
  intensities: Float32Array[];
  /** フレーム数 */
  timeFrames: number;
  /** 周波数ビン数 */
  frequencyBins: number;
}

/**
 * FFT分析結果
 */
export interface FFTAnalysisResult extends FFTResult {
  /** FFTサイズ */
  fftSize: number;
  /** 使用されたウィンドウ関数 */
  windowFunction: string;
  /** プロバイダー名 */
  providerName: string;
}

/**
 * スペクトラム解析結果
 */
export interface SpectrumAnalysisResult {
  /** 周波数（Hz） */
  frequencies: Float32Array;
  /** 強度 */
  magnitudes: Float32Array;
  /** dB値（decielsオプションがtrueの場合） */
  decibels?: Float32Array;
  /** スペクトログラム（timeFrames > 1の場合） */
  spectrogram?: SpectrogramData;
}

/**
 * ウィンドウ関数を適用
 */
function applyWindow(data: Float32Array, windowType: string): Float32Array {
  const windowed = new Float32Array(data.length);
  const N = data.length;
  
  for (let i = 0; i < N; i++) {
    let windowValue = 1;
    
    switch (windowType) {
      case 'hann':
        windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
        break;
      case 'hamming':
        windowValue = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
        break;
      case 'blackman':
        windowValue = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (N - 1));
        break;
      case 'none':
      default:
        windowValue = 1;
        break;
    }
    
    windowed[i] = (data[i] || 0) * windowValue;
  }
  
  return windowed;
}

/**
 * 指定されたチャンネルのデータを取得
 */
function getChannelData(audio: AudioData, channel: number): Float32Array {
  if (channel === -1) {
    // 全チャンネルの平均を計算
    const averageData = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        const channelData = audio.channelData[ch];
        if (channelData && i < channelData.length) {
          sum += channelData[i] as number;
        }
      }
      averageData[i] = sum / audio.numberOfChannels;
    }
    return averageData;
  }

  if (channel < 0 || channel >= audio.numberOfChannels) {
    throw new AudioInspectError('INVALID_INPUT', `無効なチャンネル番号: ${channel}`);
  }

  const channelData = audio.channelData[channel];
  if (!channelData) {
    throw new AudioInspectError('INVALID_INPUT', `チャンネル ${channel} のデータが存在しません`);
  }

  return channelData;
}

/**
 * FFT分析を行う
 * 
 * @param audio - 音声データ
 * @param options - FFTオプション
 * @returns FFT結果
 */
export async function getFFT(audio: AudioData, options: FFTOptions = {}): Promise<FFTAnalysisResult> {
  const {
    fftSize = 2048,
    windowFunction = 'hann',
    channel = 0,
    provider = 'webfft',
    enableProfiling = false
  } = options;
  
  // チャンネルデータを取得
  const channelData = getChannelData(audio, channel);
  
  // FFTサイズが入力より大きい場合、ゼロパディング
  let inputData: Float32Array;
  if (channelData.length < fftSize) {
    inputData = new Float32Array(fftSize);
    inputData.set(channelData);
  } else {
    inputData = channelData.slice(0, fftSize);
  }
  
  // ウィンドウ関数を適用
  const windowedData = applyWindow(inputData, windowFunction);
  
  // FFTプロバイダーを作成
  const fftProvider = await FFTProviderFactory.createProvider({
    type: provider,
    fftSize,
    sampleRate: audio.sampleRate,
    enableProfiling
  });
  
  try {
    // FFTを実行
    const result = fftProvider.fft(windowedData);
    
    return {
      ...result,
      fftSize,
      windowFunction,
      providerName: fftProvider.name
    };
  } finally {
    // リソースを解放
    fftProvider.dispose();
  }
}

/**
 * スペクトラム解析を行う
 * 
 * @param audio - 音声データ
 * @param options - スペクトラムオプション
 * @returns スペクトラム解析結果
 */
export async function getSpectrum(audio: AudioData, options: SpectrumOptions = {}): Promise<SpectrumAnalysisResult> {
  const {
    fftSize = 2048,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    decibels = true,
    timeFrames = 1,
    overlap = 0.5,
    ...fftOptions
  } = options;
  
  const channelData = getChannelData(audio, options.channel || 0);
  
  if (timeFrames === 1) {
    // 単一フレームのスペクトラム解析
    const fftResult = await getFFT(audio, { ...fftOptions, fftSize });
    
    // 周波数範囲をフィルタリング
    const filteredResult = filterFrequencyRange(fftResult, minFrequency, maxFrequency);
    
    const result: SpectrumAnalysisResult = {
      frequencies: filteredResult.frequencies,
      magnitudes: filteredResult.magnitude
    };
    
    if (decibels) {
      result.decibels = magnitudeToDecibels(filteredResult.magnitude);
    }
    
    return result;
  } else {
    // スペクトログラム解析
    const spectrogram = await computeSpectrogram(
      channelData, 
      audio.sampleRate,
      fftSize,
      timeFrames,
      overlap,
      { ...fftOptions, minFrequency, maxFrequency, decibels }
    );
    
    return {
      frequencies: spectrogram.frequencies,
      magnitudes: new Float32Array(), // スペクトログラムでは個別のmagnitudesは空
      spectrogram
    };
  }
}

/**
 * 周波数範囲をフィルタリング
 */
function filterFrequencyRange(fftResult: FFTResult, minFreq: number, maxFreq: number): FFTResult {
  const { frequencies, magnitude, phase, complex } = fftResult;
  
  const startIndex = frequencies.findIndex(f => f >= minFreq);
  const endIndex = frequencies.findIndex(f => f > maxFreq);
  const actualEndIndex = endIndex === -1 ? frequencies.length : endIndex;
  
  return {
    frequencies: frequencies.slice(startIndex, actualEndIndex),
    magnitude: magnitude.slice(startIndex, actualEndIndex),
    phase: phase.slice(startIndex, actualEndIndex),
    complex: complex.slice(startIndex * 2, actualEndIndex * 2)
  };
}

/**
 * 振幅をdBに変換
 */
function magnitudeToDecibels(magnitude: Float32Array): Float32Array {
  const decibels = new Float32Array(magnitude.length);
  for (let i = 0; i < magnitude.length; i++) {
    const mag = magnitude[i] || 0;
    decibels[i] = mag > 0 ? 20 * Math.log10(mag) : -Infinity;
  }
  return decibels;
}

/**
 * スペクトログラムを計算
 */
async function computeSpectrogram(
  data: Float32Array,
  sampleRate: number,
  fftSize: number,
  timeFrames: number,
  overlap: number,
  options: any
): Promise<SpectrogramData> {
  const hopSize = Math.floor(fftSize * (1 - overlap));
  const actualFrames = Math.min(timeFrames, Math.floor((data.length - fftSize) / hopSize) + 1);
  
  const times = new Float32Array(actualFrames);
  const intensities: Float32Array[] = [];
  let frequencies: Float32Array = new Float32Array();
  
  // FFTプロバイダーを作成（一度だけ）
  const fftProvider = await FFTProviderFactory.createProvider({
    type: options.provider || 'webfft',
    fftSize,
    sampleRate,
    enableProfiling: options.enableProfiling || false
  });
  
  try {
    for (let frame = 0; frame < actualFrames; frame++) {
      const startSample = frame * hopSize;
      const endSample = Math.min(startSample + fftSize, data.length);
      
      // フレームデータを抽出
      const frameData = new Float32Array(fftSize);
      for (let i = 0; i < fftSize && (startSample + i) < data.length; i++) {
        frameData[i] = data[startSample + i] || 0;
      }
      
      // ウィンドウ関数を適用
      const windowedData = applyWindow(frameData, options.windowFunction || 'hann');
      
      // FFTを実行
      const fftResult = fftProvider.fft(windowedData);
      
      // 最初のフレームで周波数軸を設定
      if (frame === 0) {
        frequencies = fftResult.frequencies;
      }
      
      // 強度データを保存
      const magnitude = fftResult.magnitude;
      const frameIntensity = options.decibels ? magnitudeToDecibels(magnitude) : magnitude;
      intensities.push(frameIntensity);
      
      // 時間位置を計算
      times[frame] = (startSample + fftSize / 2) / sampleRate;
    }
  } finally {
    fftProvider.dispose();
  }
  
  return {
    times,
    frequencies,
    intensities,
    timeFrames: actualFrames,
    frequencyBins: frequencies.length
  };
} 