// 時間領域の特徴量
export { getPeaks, getRMS, getZeroCrossing, getWaveform, getPeak, getPeakAmplitude } from './time.js';
export type {
  PeaksOptions,
  Peak,
  PeaksResult,
  WaveformOptions,
  WaveformPoint,
  WaveformResult
} from './time.js';

// 周波数領域の特徴量
export { getFFT, getSpectrum } from './frequency.js';
export type {
  FFTOptions,
  SpectrumOptions,
  FFTAnalysisResult,
  SpectrumAnalysisResult,
  SpectrogramData
} from './frequency.js';

// スペクトル特徴量
export { getSpectralFeatures, getTimeVaryingSpectralFeatures } from './spectral.js';
export type {
  SpectralFeaturesOptions,
  SpectralFeaturesResult,
  TimeVaryingSpectralOptions,
  TimeVaryingSpectralResult
} from './spectral.js';

// エネルギー解析
export { getEnergy } from './energy.js';
export type {
  EnergyOptions,
  EnergyResult
} from './energy.js';

// ダイナミクス解析
export { getCrestFactor } from './dynamics.js';
export type {
  CrestFactorOptions,
  CrestFactorResult
} from './dynamics.js';

// ステレオ解析
export { getStereoAnalysis, getTimeVaryingStereoAnalysis } from './stereo.js';
export type {
  StereoAnalysisOptions,
  StereoAnalysisResult
} from './stereo.js';

// VAD（音声区間検出）
export { getVAD } from './vad.js';
export type {
  VADOptions,
  VADSegment,
  VADResult
} from './vad.js';

// LUFS（ラウドネス測定）
export { getLUFS } from './loudness.js';
export type {
  LUFSOptions,
  LUFSResult
} from './loudness.js';
