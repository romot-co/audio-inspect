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
  FrequencyRangeOptions,
  AudioInspectNodeOptions,
  AudioInspectProcessorOptions,
  AudioInspectNodeEventHandlers
} from './types.js';

// エラー関連
export { AudioInspectError, isAudioInspectError } from './types.js';

// コア機能
export { load } from './core/load.js';
export { analyze } from './core/analyze.js';
export { stream, createAudioInspectNode } from './core/stream.js';

// AudioWorklet関連
export { AudioInspectNode } from './core/AudioInspectNode.js';

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
