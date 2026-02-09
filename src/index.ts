export { load } from './core/load.js';
export { analyze, inspect } from './core/analyze.js';
export { monitor } from './core/realtime/monitor.js';
export { prepareWorklet } from './core/realtime/worklet.js';
export { FEATURES } from './core/feature-registry.js';
export { AudioInspectError, isAudioInspectError } from './types.js';

export type {
  AudioSource,
  AudioData,
  AudioLike,
  LoadOptions,
  AudioDecoder,
  ChannelSelector
} from './types.js';
export type {
  FeatureRegistry,
  FeatureId,
  FeatureOptions,
  FeatureResult,
  FeatureSelection,
  FeatureInput,
  SelectedFeatureIds,
  RMSOptions,
  PeakOptions,
  RMSResult,
  PeakResult,
  ZeroCrossingResult,
  FFTResult,
  SpectrumResult,
  MFCCWithDeltaOptions,
  MFCCWithDeltaResult,
  StereoOptions,
  StereoResult,
  ZeroCrossingOptions,
  TimeVaryingStereoOptions,
  TimeVaryingStereoResult
} from './core/feature-registry.js';
export type {
  TimeRange,
  AnalyzeRequest,
  AnalyzeResult,
  AnalyzeProgressEvent,
  InspectRequest,
  InspectResult
} from './core/analyze.js';
export type {
  MonitorSource,
  MonitorEngine,
  MonitorState,
  MonitorOptions,
  MonitorFrame,
  MonitorErrorEvent,
  MonitorSession
} from './core/realtime/monitor.js';
export type { PrepareWorkletOptions } from './core/realtime/worklet.js';
