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
  getCQT,
  getMFCC,
  getMFCCWithDelta,
  getMelSpectrogram,
  getSpectralCrest,
  getSpectralEntropy,
  getSpectralFeatures,
  getTimeVaryingSpectralFeatures,
  type CQTOptions,
  type CQTResult,
  type MelSpectrogramOptions,
  type MelSpectrogramResult,
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
  getPeaksAnalysis,
  getRMS,
  getRMSAnalysis,
  getWaveform,
  getWaveformAnalysis,
  getZeroCrossing,
  type PeaksAnalysisOptions,
  type PeaksOptions,
  type PeaksResult,
  type RMSAnalysisOptions,
  type WaveformAnalysisOptions,
  type WaveformOptions,
  type WaveformResult
} from '../features/time.js';
import { getVAD, type VADOptions, type VADResult } from '../features/vad.js';
import {
  getCrestFactor,
  type CrestFactorOptions,
  type CrestFactorResult
} from '../features/dynamics.js';
import type { FFTProviderCache } from './dsp/fft-runtime.js';
import { RealtimeLUFSExecutor } from './realtime/lufs-executor.js';
import type { WindowCache } from './dsp/window.js';

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
  rmsAnalysis: { options: RMSAnalysisOptions; result: ReturnType<typeof getRMSAnalysis> };
  peak: { options: PeakOptions; result: PeakResult };
  peaks: { options: PeaksOptions; result: PeaksResult };
  peaksAnalysis: { options: PeaksAnalysisOptions; result: ReturnType<typeof getPeaksAnalysis> };
  waveform: { options: WaveformOptions; result: WaveformResult };
  waveformAnalysis: {
    options: WaveformAnalysisOptions;
    result: ReturnType<typeof getWaveformAnalysis>;
  };

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

  melSpectrogram: { options: MelSpectrogramOptions; result: MelSpectrogramResult };
  cqt: { options: CQTOptions; result: CQTResult };

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

export type FeatureInput<T extends FeatureId = FeatureId> = FeatureSelection<T> | readonly T[];

export type SelectedFeatureIds<F> = F extends readonly (infer I)[]
  ? Extract<I, FeatureId>
  : Extract<keyof F, FeatureId>;

export const FEATURES: readonly FeatureId[] = Object.freeze([
  'rms',
  'rmsAnalysis',
  'peak',
  'peaks',
  'peaksAnalysis',
  'waveform',
  'waveformAnalysis',
  'zeroCrossing',
  'energy',
  'fft',
  'spectrum',
  'spectralFeatures',
  'timeVaryingSpectralFeatures',
  'spectralEntropy',
  'spectralCrest',
  'melSpectrogram',
  'cqt',
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
  options?: FeatureOptions<K>,
  runtime?: FeatureExecutionRuntime
) => FeatureResult<K> | Promise<FeatureResult<K>>;

export interface FeatureExecutionRuntime {
  fftProviderCache?: FFTProviderCache;
  windowCache?: WindowCache;
  spectralCache?: Map<string, unknown>;
  realtimeLUFS?: RealtimeLUFSExecutor;
}

export interface FeatureDef<K extends FeatureId = FeatureId> {
  id: K;
  realtime: boolean;
  needsFFT?: boolean;
  exec: FeatureExecutor<K>;
}

const FFT_POWERED_FEATURES: ReadonlySet<FeatureId> = new Set<FeatureId>([
  'fft',
  'spectrum',
  'spectralFeatures',
  'timeVaryingSpectralFeatures',
  'spectralEntropy',
  'spectralCrest',
  'melSpectrogram',
  'cqt',
  'mfcc',
  'mfccWithDelta',
  'stereo'
]);

function withRuntimeOptions<K extends FeatureId>(
  feature: K,
  options: FeatureOptions<K> | undefined,
  runtime: FeatureExecutionRuntime | undefined
): FeatureOptions<K> | undefined {
  if (!runtime?.fftProviderCache) {
    return options;
  }

  if (!FFT_POWERED_FEATURES.has(feature)) {
    return options;
  }

  const optionRecord =
    options && typeof options === 'object' && !Array.isArray(options)
      ? (options as Record<string, unknown>)
      : {};

  return {
    ...optionRecord,
    providerCache: runtime.fftProviderCache
  } as FeatureOptions<K>;
}

export const FEATURE_DEFS: { [K in FeatureId]: FeatureDef<K> } = {
  rms: { id: 'rms', realtime: true, exec: (audio, options) => getRMS(audio, options ?? {}) },
  rmsAnalysis: {
    id: 'rmsAnalysis',
    realtime: true,
    exec: (audio, options) => getRMSAnalysis(audio, options ?? {})
  },
  peak: {
    id: 'peak',
    realtime: true,
    exec: (audio, options) => getPeakAmplitude(audio, options ?? {})
  },
  peaks: { id: 'peaks', realtime: true, exec: (audio, options) => getPeaks(audio, options ?? {}) },
  peaksAnalysis: {
    id: 'peaksAnalysis',
    realtime: true,
    exec: (audio, options) => getPeaksAnalysis(audio, options ?? {})
  },
  waveform: {
    id: 'waveform',
    realtime: true,
    exec: (audio, options) => getWaveform(audio, options ?? {})
  },
  waveformAnalysis: {
    id: 'waveformAnalysis',
    realtime: true,
    exec: (audio, options) => getWaveformAnalysis(audio, options ?? {})
  },

  zeroCrossing: {
    id: 'zeroCrossing',
    realtime: true,
    exec: (audio, options) => getZeroCrossing(audio, options?.channel ?? 'mix')
  },
  energy: {
    id: 'energy',
    realtime: true,
    exec: (audio, options) => getEnergy(audio, options ?? {})
  },

  fft: {
    id: 'fft',
    realtime: true,
    needsFFT: true,
    exec: (audio, options, runtime) =>
      getFFT(audio, withRuntimeOptions('fft', options, runtime) ?? {})
  },
  spectrum: {
    id: 'spectrum',
    realtime: true,
    needsFFT: true,
    exec: (audio, options, runtime) =>
      getSpectrum(audio, withRuntimeOptions('spectrum', options, runtime) ?? {})
  },
  spectralFeatures: {
    id: 'spectralFeatures',
    realtime: true,
    needsFFT: true,
    exec: (audio, options, runtime) =>
      getSpectralFeatures(audio, withRuntimeOptions('spectralFeatures', options, runtime) ?? {})
  },
  timeVaryingSpectralFeatures: {
    id: 'timeVaryingSpectralFeatures',
    realtime: true,
    needsFFT: true,
    exec: (audio, options, runtime) =>
      getTimeVaryingSpectralFeatures(
        audio,
        withRuntimeOptions('timeVaryingSpectralFeatures', options, runtime) ?? {}
      )
  },
  spectralEntropy: {
    id: 'spectralEntropy',
    realtime: true,
    needsFFT: true,
    exec: (audio, options, runtime) =>
      getSpectralEntropy(audio, withRuntimeOptions('spectralEntropy', options, runtime) ?? {})
  },
  spectralCrest: {
    id: 'spectralCrest',
    realtime: true,
    needsFFT: true,
    exec: (audio, options, runtime) =>
      getSpectralCrest(audio, withRuntimeOptions('spectralCrest', options, runtime) ?? {})
  },
  melSpectrogram: {
    id: 'melSpectrogram',
    realtime: true,
    needsFFT: true,
    exec: (audio, options, runtime) =>
      getMelSpectrogram(audio, withRuntimeOptions('melSpectrogram', options, runtime) ?? {})
  },
  cqt: {
    id: 'cqt',
    realtime: true,
    needsFFT: true,
    exec: (audio, options, runtime) =>
      getCQT(audio, withRuntimeOptions('cqt', options, runtime) ?? {})
  },

  mfcc: {
    id: 'mfcc',
    realtime: true,
    needsFFT: true,
    exec: (audio, options, runtime) =>
      getMFCC(audio, withRuntimeOptions('mfcc', options, runtime) ?? {})
  },
  mfccWithDelta: {
    id: 'mfccWithDelta',
    realtime: true,
    needsFFT: true,
    exec: (audio, options, runtime) =>
      getMFCCWithDelta(audio, withRuntimeOptions('mfccWithDelta', options, runtime) ?? {})
  },

  lufs: {
    id: 'lufs',
    realtime: true,
    exec: (audio, options, runtime) => {
      if (runtime?.realtimeLUFS) {
        return runtime.realtimeLUFS.process(audio, options ?? {});
      }
      return getLUFS(audio, options ?? {});
    }
  },
  vad: { id: 'vad', realtime: true, exec: (audio, options) => getVAD(audio, options ?? {}) },
  crestFactor: {
    id: 'crestFactor',
    realtime: true,
    exec: (audio, options) => getCrestFactor(audio, options ?? {})
  },
  stereo: {
    id: 'stereo',
    realtime: true,
    needsFFT: true,
    exec: (audio, options, runtime) =>
      getStereoAnalysis(audio, withRuntimeOptions('stereo', options, runtime) ?? {})
  },
  timeVaryingStereo: {
    id: 'timeVaryingStereo',
    realtime: true,
    exec: (audio, options) => getTimeVaryingStereoAnalysis(audio, options ?? {})
  }
};

export async function executeFeature<K extends FeatureId>(
  feature: K,
  audio: AudioData,
  options?: FeatureOptions<K>,
  runtime?: FeatureExecutionRuntime
): Promise<FeatureResult<K>> {
  const definition = FEATURE_DEFS[feature] as FeatureDef<K>;
  return definition.exec(audio, options, runtime);
}

export function normalizeFeatureInput<F extends FeatureInput>(
  features: F
): FeatureSelection<SelectedFeatureIds<F>> {
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
