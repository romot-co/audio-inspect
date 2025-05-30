// 型定義
export type {
  AudioSource,
  AudioData,
  Feature,
  LoadOptions,
  StreamController,
  StreamOptions,
  WindowFunction,
  ErrorCode,
  AmplitudeOptions,
  CommonAnalysisOptions,
  TimeWindowOptions,
  FrequencyRangeOptions
} from './types.js';

// エラー関連
export { AudioInspectError, isAudioInspectError } from './types.js';

// コア機能
export { load } from './core/load.js';
export { analyze } from './core/analyze.js';
export { stream } from './core/stream.js';

// ユーティリティ
export { 
  getChannelData, 
  isPowerOfTwo, 
  nextPowerOfTwo, 
  amplitudeToDecibels, 
  decibelsToAmplitude 
} from './core/utils.js';

// FFTプロバイダー
export { FFTProviderFactory } from './core/fft-provider.js';
export type { 
  FFTProviderType, 
  IFFTProvider, 
  FFTProviderConfig, 
  FFTResult 
} from './core/fft-provider.js';

// すべての特徴量機能
export * from './features/index.js'; 