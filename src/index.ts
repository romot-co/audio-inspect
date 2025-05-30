// 型定義
export type {
  AudioSource,
  AudioData,
  Feature,
  LoadOptions,
  StreamController,
  StreamOptions,
  StreamOptionsWithFallback,
  WindowFunction,
  ErrorCode,
  AmplitudeOptions,
  CommonAnalysisOptions,
  TimeWindowOptions,
  FrequencyRangeOptions,
  AudioInspectNodeOptions,
  AudioInspectProcessorOptions,
  AudioInspectNodeEventHandlers,
  
  // 新しい型定義
  ProgressOptions,
  BaseAnalysisResult,
  WaveformAnalysisResult,
  PeaksAnalysisResult,
  SpectrumAnalysisResult,
  EnergyAnalysisResult,
  RMSAnalysisResult,
  BatchAnalysisOptions,
  BatchAnalysisResult
} from './types.js';

// エラー関連
export { AudioInspectError, isAudioInspectError, createError } from './types.js';

// コア機能
export { load } from './core/load.js';
export { analyze } from './core/analyze.js';
export {
  stream,
  createAudioInspectNode,
  getDefaultProcessorUrl,
  createAudioInspectNodeWithDefaults,
  streamWithFallback
} from './core/stream.js';

// バッチ処理API（新機能）
export { analyzeAll } from './core/batch.js';

// AudioWorklet関連
export { AudioInspectNode } from './core/AudioInspectNode.js';

// ユーティリティ
export {
  getChannelData,
  isPowerOfTwo,
  nextPowerOfTwo,
  amplitudeToDecibels,
  decibelsToAmplitude,
  
  // 新しいユーティリティ関数
  toMono,
  sliceAudio,
  normalizeAudio
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

// 新しい解析機能（Float32Array対応）
export {
  getWaveformAnalysis,
  getPeaksAnalysis,
  getRMSAnalysis
} from './features/time.js';

export type {
  WaveformAnalysisOptions,
  PeaksAnalysisOptions,
  RMSAnalysisOptions
} from './features/time.js';
