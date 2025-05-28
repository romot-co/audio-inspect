// 型定義
export type {
  AudioSource,
  AudioData,
  Feature,
  LoadOptions,
  StreamController,
  StreamOptions,
  WindowFunction,
  ErrorCode
} from './types.js';

// エラー関連
export { AudioInspectError, isAudioInspectError } from './types.js';

// コア機能
export { load } from './core/load.js';
export { analyze } from './core/analyze.js';
export { stream } from './core/stream.js';

// FFTプロバイダー
export { FFTProviderFactory } from './core/fft-provider.js';
export type { 
  FFTProviderType, 
  IFFTProvider, 
  FFTProviderConfig, 
  FFTResult 
} from './core/fft-provider.js';

// 時間領域の特徴量
export { getPeaks, getRMS, getZeroCrossing, getWaveform } from './features/time.js';
export type { PeaksOptions, Peak, PeaksResult, WaveformOptions, WaveformPoint, WaveformResult } from './features/time.js';

// 周波数領域の特徴量
export { getFFT, getSpectrum } from './features/frequency.js';
export type { 
  FFTOptions, 
  SpectrumOptions, 
  FFTAnalysisResult, 
  SpectrumAnalysisResult,
  SpectrogramData
} from './features/frequency.js'; 