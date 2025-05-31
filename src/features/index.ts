// 時間領域の特徴量
export {
  getPeaks,
  getRMS,
  getZeroCrossing,
  getWaveform,
  getPeak,
  getPeakAmplitude,

  // 新しい解析機能（Float32Array対応）
  getWaveformAnalysis,
  getPeaksAnalysis,
  getRMSAnalysis
} from './time.js';
export type {
  PeaksOptions,
  Peak,
  PeaksResult,
  WaveformOptions,
  WaveformPoint,
  WaveformResult,

  // 新しい型定義
  WaveformAnalysisOptions,
  PeaksAnalysisOptions,
  RMSAnalysisOptions
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
export {
  getSpectralFeatures,
  getTimeVaryingSpectralFeatures,
  getSpectralEntropy,
  getSpectralCrest,
  getMFCC,
  getMFCCWithDelta
} from './spectral.js';
export type {
  SpectralFeaturesOptions,
  SpectralFeaturesResult,
  TimeVaryingSpectralOptions,
  TimeVaryingSpectralResult,
  SpectralEntropyOptions,
  SpectralEntropyResult,
  SpectralCrestOptions,
  SpectralCrestResult,
  MFCCOptions,
  MFCCResult,
  MFCCDeltaOptions,
  MFCCDeltaResult
} from './spectral.js';

// エネルギー解析
export { getEnergy } from './energy.js';
export type { EnergyOptions, EnergyResult } from './energy.js';

// ダイナミクス解析
export { getCrestFactor } from './dynamics.js';
export type { CrestFactorOptions, CrestFactorResult } from './dynamics.js';

// ステレオ解析
export { getStereoAnalysis, getTimeVaryingStereoAnalysis } from './stereo.js';
export type { StereoAnalysisOptions, StereoAnalysisResult } from './stereo.js';

// VAD（音声区間検出）
export { getVAD } from './vad.js';
export type { VADOptions, VADSegment, VADResult } from './vad.js';

// LUFS（ラウドネス測定）
export { getLUFS, getLUFSRealtime } from './loudness.js';
export type { LUFSOptions, LUFSResult, RealtimeLUFSOptions } from './loudness.js';
