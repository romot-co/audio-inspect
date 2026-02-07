import type { AmplitudeOptions, AudioData, ChannelSelector } from '../types.js';
import { getEnergy, type EnergyOptions, type EnergyResult } from '../features/energy.js';
import {
  getFFT,
  getSpectrum,
  type FFTAnalysisResult,
  type FFTOptions,
  type SpectrumAnalysisResult,
  type SpectrumOptions
} from '../features/frequency.js';
import { getLUFS, type LUFSOptions, type LUFSResult } from '../features/loudness.js';
import {
  getMFCC,
  getMFCCWithDelta,
  getSpectralCrest,
  getSpectralEntropy,
  getSpectralFeatures,
  getTimeVaryingSpectralFeatures,
  type MFCCDeltaOptions,
  type MFCCDeltaResult,
  type MFCCOptions,
  type MFCCResult,
  type SpectralCrestOptions,
  type SpectralCrestResult,
  type SpectralEntropyOptions,
  type SpectralEntropyResult,
  type SpectralFeaturesOptions,
  type SpectralFeaturesResult,
  type TimeVaryingSpectralOptions,
  type TimeVaryingSpectralResult
} from '../features/spectral.js';
import {
  getStereoAnalysis,
  getTimeVaryingStereoAnalysis,
  type StereoAnalysisOptions,
  type StereoAnalysisResult
} from '../features/stereo.js';
import {
  getPeakAmplitude,
  getPeaks,
  getRMS,
  getWaveform,
  getZeroCrossing,
  type PeaksOptions,
  type PeaksResult,
  type WaveformOptions,
  type WaveformResult
} from '../features/time.js';
import { getVAD, type VADOptions, type VADResult } from '../features/vad.js';
import {
  getCrestFactor,
  type CrestFactorOptions,
  type CrestFactorResult
} from '../features/dynamics.js';

export interface ZeroCrossingOptions {
  channel?: ChannelSelector;
}

export interface TimeVaryingStereoOptions extends StereoAnalysisOptions {
  windowSize?: number;
}

export type TimeVaryingStereoResult = Awaited<ReturnType<typeof getTimeVaryingStereoAnalysis>>;

// Result aliases for stable public naming
export type RMSOptions = AmplitudeOptions;
export type PeakOptions = AmplitudeOptions;
export type RMSResult = number;
export type PeakResult = number;
export type ZeroCrossingResult = number;
export type FFTResult = FFTAnalysisResult;
export type SpectrumResult = SpectrumAnalysisResult;
export type MFCCWithDeltaOptions = MFCCDeltaOptions;
export type MFCCWithDeltaResult = MFCCDeltaResult;
export type StereoOptions = StereoAnalysisOptions;
export type StereoResult = StereoAnalysisResult;

export interface FeatureRegistry {
  rms: { options: RMSOptions; result: RMSResult };
  peak: { options: PeakOptions; result: PeakResult };
  peaks: { options: PeaksOptions; result: PeaksResult };
  waveform: { options: WaveformOptions; result: WaveformResult };

  zeroCrossing: { options: ZeroCrossingOptions; result: ZeroCrossingResult };
  energy: { options: EnergyOptions; result: EnergyResult };

  fft: { options: FFTOptions; result: FFTResult };
  spectrum: { options: SpectrumOptions; result: SpectrumResult };

  spectralFeatures: { options: SpectralFeaturesOptions; result: SpectralFeaturesResult };
  timeVaryingSpectralFeatures: {
    options: TimeVaryingSpectralOptions;
    result: TimeVaryingSpectralResult;
  };

  spectralEntropy: { options: SpectralEntropyOptions; result: SpectralEntropyResult };
  spectralCrest: { options: SpectralCrestOptions; result: SpectralCrestResult };

  mfcc: { options: MFCCOptions; result: MFCCResult };
  mfccWithDelta: { options: MFCCWithDeltaOptions; result: MFCCWithDeltaResult };

  lufs: { options: LUFSOptions; result: LUFSResult };
  vad: { options: VADOptions; result: VADResult };

  crestFactor: { options: CrestFactorOptions; result: CrestFactorResult };

  stereo: { options: StereoOptions; result: StereoResult };
  timeVaryingStereo: { options: TimeVaryingStereoOptions; result: TimeVaryingStereoResult };
}

export type FeatureId = keyof FeatureRegistry & string;

export type FeatureOptions<K extends FeatureId> = FeatureRegistry[K]['options'];
export type FeatureResult<K extends FeatureId> = FeatureRegistry[K]['result'];

export type FeatureSelection<T extends FeatureId = FeatureId> = {
  [K in T]?: FeatureOptions<K> | true;
};

export type FeatureInput<T extends FeatureId = FeatureId> =
  | FeatureSelection<T>
  | readonly T[];

export type SelectedFeatureIds<F> =
  F extends readonly (infer I)[] ? Extract<I, FeatureId> : Extract<keyof F, FeatureId>;

export const FEATURES: readonly FeatureId[] = Object.freeze([
  'rms',
  'peak',
  'peaks',
  'waveform',
  'zeroCrossing',
  'energy',
  'fft',
  'spectrum',
  'spectralFeatures',
  'timeVaryingSpectralFeatures',
  'spectralEntropy',
  'spectralCrest',
  'mfcc',
  'mfccWithDelta',
  'lufs',
  'vad',
  'crestFactor',
  'stereo',
  'timeVaryingStereo'
]);

type FeatureExecutor<K extends FeatureId> = (
  audio: AudioData,
  options?: FeatureOptions<K>
) => FeatureResult<K> | Promise<FeatureResult<K>>;

const FEATURE_EXECUTORS: { [K in FeatureId]: FeatureExecutor<K> } = {
  rms: (audio, options) => getRMS(audio, options ?? {}),
  peak: (audio, options) => getPeakAmplitude(audio, options ?? {}),
  peaks: (audio, options) => getPeaks(audio, options ?? {}),
  waveform: (audio, options) => getWaveform(audio, options ?? {}),

  zeroCrossing: (audio, options) => getZeroCrossing(audio, options?.channel ?? 0),
  energy: (audio, options) => getEnergy(audio, options ?? {}),

  fft: async (audio, options) => getFFT(audio, options ?? {}),
  spectrum: async (audio, options) => getSpectrum(audio, options ?? {}),

  spectralFeatures: async (audio, options) => getSpectralFeatures(audio, options ?? {}),
  timeVaryingSpectralFeatures: async (audio, options) =>
    getTimeVaryingSpectralFeatures(audio, options ?? {}),

  spectralEntropy: async (audio, options) => getSpectralEntropy(audio, options ?? {}),
  spectralCrest: async (audio, options) => getSpectralCrest(audio, options ?? {}),

  mfcc: async (audio, options) => getMFCC(audio, options ?? {}),
  mfccWithDelta: async (audio, options) => getMFCCWithDelta(audio, options ?? {}),

  lufs: (audio, options) => getLUFS(audio, options ?? {}),
  vad: (audio, options) => getVAD(audio, options ?? {}),

  crestFactor: (audio, options) => getCrestFactor(audio, options ?? {}),

  stereo: async (audio, options) => getStereoAnalysis(audio, options ?? {}),
  timeVaryingStereo: async (audio, options) => getTimeVaryingStereoAnalysis(audio, options ?? {})
};

const FEATURE_FUNCTION_NAMES: { [K in FeatureId]: string } = {
  rms: 'getRMS',
  peak: 'getPeakAmplitude',
  peaks: 'getPeaks',
  waveform: 'getWaveform',
  zeroCrossing: 'getZeroCrossing',
  energy: 'getEnergy',
  fft: 'getFFT',
  spectrum: 'getSpectrum',
  spectralFeatures: 'getSpectralFeatures',
  timeVaryingSpectralFeatures: 'getTimeVaryingSpectralFeatures',
  spectralEntropy: 'getSpectralEntropy',
  spectralCrest: 'getSpectralCrest',
  mfcc: 'getMFCC',
  mfccWithDelta: 'getMFCCWithDelta',
  lufs: 'getLUFS',
  vad: 'getVAD',
  crestFactor: 'getCrestFactor',
  stereo: 'getStereoAnalysis',
  timeVaryingStereo: 'getTimeVaryingStereoAnalysis'
};

export function getFeatureFunctionName(feature: FeatureId): string {
  return FEATURE_FUNCTION_NAMES[feature];
}

export async function executeFeature<K extends FeatureId>(
  feature: K,
  audio: AudioData,
  options?: FeatureOptions<K>
): Promise<FeatureResult<K>> {
  const executor = FEATURE_EXECUTORS[feature] as FeatureExecutor<K>;
  return executor(audio, options);
}

export function normalizeFeatureInput<F extends FeatureInput>(features: F): FeatureSelection<SelectedFeatureIds<F>> {
  if (Array.isArray(features)) {
    const selection: Partial<Record<FeatureId, true>> = {};
    for (const feature of features) {
      selection[feature as FeatureId] = true;
    }
    return selection as FeatureSelection<SelectedFeatureIds<F>>;
  }

  return features as FeatureSelection<SelectedFeatureIds<F>>;
}

export function getActiveFeatureEntries<F extends FeatureInput>(
  features: F
): Array<[SelectedFeatureIds<F>, FeatureOptions<SelectedFeatureIds<F>> | true]> {
  const selection = normalizeFeatureInput(features);
  const entries = Object.entries(selection) as Array<
    [SelectedFeatureIds<F>, FeatureOptions<SelectedFeatureIds<F>> | true | undefined]
  >;

  return entries.filter(([, options]) => options !== undefined) as Array<
    [SelectedFeatureIds<F>, FeatureOptions<SelectedFeatureIds<F>> | true]
  >;
}
