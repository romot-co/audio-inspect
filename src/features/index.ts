// Time-domain features.
export {
  getPeaks,
  getRMS,
  getZeroCrossing,
  getWaveform,
  getPeak,
  getPeakAmplitude,
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
  WaveformAnalysisOptions,
  PeaksAnalysisOptions,
  RMSAnalysisOptions
} from './time.js';

// Frequency-domain primitives.
export { getFFT, getSpectrum } from './frequency.js';
export type {
  FFTOptions,
  SpectrumOptions,
  FFTAnalysisResult,
  SpectrumAnalysisResult,
  SpectrogramData
} from './frequency.js';

// Spectral descriptors and transforms.
export {
  getCQT,
  getSpectralFeatures,
  getTimeVaryingSpectralFeatures,
  getSpectralEntropy,
  getSpectralCrest,
  getMelSpectrogram,
  getMFCC,
  getMFCCWithDelta
} from './spectral.js';
export type {
  CQTOptions,
  CQTResult,
  MelSpectrogramOptions,
  MelSpectrogramResult,
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

// Energy and dynamics.
export { getEnergy } from './energy.js';
export type { EnergyOptions, EnergyResult } from './energy.js';

export { getCrestFactor } from './dynamics.js';
export type { CrestFactorOptions, CrestFactorResult } from './dynamics.js';

// Stereo image and VAD.
export { getStereoAnalysis, getTimeVaryingStereoAnalysis } from './stereo.js';
export type { StereoAnalysisOptions, StereoAnalysisResult } from './stereo.js';

export { getVAD } from './vad.js';
export type { VADOptions, VADSegment, VADResult } from './vad.js';

// Loudness (LUFS).
export { getLUFS, getLUFSRealtime } from './loudness.js';
export type { LUFSOptions, LUFSResult, RealtimeLUFSOptions } from './loudness.js';
