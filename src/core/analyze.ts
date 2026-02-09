import {
  type AudioData,
  type AudioLike,
  AudioInspectError,
  type AudioSource,
  type LoadOptions
} from '../types.js';
import { getPerformanceNow } from './utils.js';
import {
  executeFeature,
  type FeatureExecutionRuntime,
  type FeatureId,
  type FeatureInput,
  type FeatureOptions,
  type FeatureResult,
  getActiveFeatureEntries,
  type SelectedFeatureIds
} from './feature-registry.js';
import { FFTProviderCacheStore } from './dsp/fft-runtime.js';
import { WindowCacheStore } from './dsp/window.js';
import { load } from './load.js';

export interface TimeRange {
  start?: number;
  end?: number;
}

export interface AnalyzeProgressEvent<T extends FeatureId = FeatureId> {
  phase: 'feature';
  completed: number;
  total: number;
  feature: T;
}

export interface AnalyzeRequest<F extends FeatureInput = FeatureInput> {
  features: F;
  range?: TimeRange;
  continueOnError?: boolean;
  onProgress?: (event: AnalyzeProgressEvent<SelectedFeatureIds<F>>) => void;
  signal?: AbortSignal;
}

export interface AnalyzeResult<T extends FeatureId = FeatureId> {
  meta: {
    sampleRate: number;
    channels: number;
    duration: number;
    length: number;
    range: Required<TimeRange>;
    totalElapsedMs: number;
  };
  results: Partial<{ [K in T]: FeatureResult<K> }>;
  errors: Partial<Record<T, AudioInspectError>>;
}

export interface InspectRequest<F extends FeatureInput = FeatureInput>
  extends Omit<AnalyzeRequest<F>, 'signal'> {
  load?: LoadOptions;
  signal?: AbortSignal;
}

export type InspectResult<T extends FeatureId = FeatureId> = AnalyzeResult<T> & {
  meta: AnalyzeResult<T>['meta'] & {
    loadElapsedMs: number;
  };
};

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new AudioInspectError('ABORTED', 'Operation aborted');
  }
}

function isAudioData(value: AudioLike): value is AudioData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sampleRate' in value &&
    'channelData' in value &&
    'duration' in value &&
    'numberOfChannels' in value &&
    'length' in value
  );
}

function toAudioData(audio: AudioLike): AudioData {
  if (isAudioData(audio)) {
    return audio;
  }

  const channelData: Float32Array[] = [];
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    channelData.push(audio.getChannelData(channel));
  }

  return {
    sampleRate: audio.sampleRate,
    channelData,
    numberOfChannels: audio.numberOfChannels,
    length: audio.length,
    duration: audio.duration
  };
}

function normalizeRange(audio: AudioData, range?: TimeRange): Required<TimeRange> {
  const start = Math.max(0, range?.start ?? 0);
  const end = Math.min(audio.duration, range?.end ?? audio.duration);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new AudioInspectError('INVALID_INPUT', `Invalid range: start=${start}, end=${end}`);
  }

  return { start, end };
}

function sliceRange(audio: AudioData, range: Required<TimeRange>): AudioData {
  const startSample = Math.floor(range.start * audio.sampleRate);
  const endSample = Math.min(audio.length, Math.ceil(range.end * audio.sampleRate));
  const length = Math.max(0, endSample - startSample);

  if (length <= 0) {
    throw new AudioInspectError('INSUFFICIENT_DATA', 'Range produced no samples');
  }

  return {
    sampleRate: audio.sampleRate,
    numberOfChannels: audio.numberOfChannels,
    length,
    duration: length / audio.sampleRate,
    channelData: audio.channelData.map((channel) => channel.subarray(startSample, endSample))
  };
}

export async function analyze<const F extends FeatureInput>(
  audio: AudioLike,
  request: AnalyzeRequest<F>
): Promise<AnalyzeResult<SelectedFeatureIds<F>>> {
  const startedAt = getPerformanceNow();
  throwIfAborted(request.signal);

  const sourceAudio = toAudioData(audio);
  const effectiveRange = normalizeRange(sourceAudio, request.range);
  const scopedAudio = sliceRange(sourceAudio, effectiveRange);

  const entries = getActiveFeatureEntries(request.features);
  const total = entries.length;
  let completed = 0;
  const continueOnError = request.continueOnError ?? false;
  const fftProviderCache = new FFTProviderCacheStore();
  const windowCache = new WindowCacheStore();
  const spectralCache = new Map<string, unknown>();
  const runtime: FeatureExecutionRuntime = {
    fftProviderCache,
    windowCache,
    spectralCache
  };

  const results: Partial<{ [K in SelectedFeatureIds<F>]: FeatureResult<K> }> = {};
  const errors: Partial<Record<SelectedFeatureIds<F>, AudioInspectError>> = {};

  try {
    const tasks = entries.map(async ([feature, rawOptions]) => {
      throwIfAborted(request.signal);
      try {
        const options =
          rawOptions === true ? undefined : (rawOptions as FeatureOptions<typeof feature>);
        const data = await executeFeature(feature, scopedAudio, options, runtime);
        return {
          feature,
          data: data as FeatureResult<typeof feature>
        };
      } catch (error) {
        const wrapped =
          error instanceof AudioInspectError
            ? error
            : new AudioInspectError(
                'PROCESSING_ERROR',
                `Feature ${feature} failed: ${error instanceof Error ? error.message : String(error)}`,
                error
              );
        if (!continueOnError) {
          throw wrapped;
        }
        return {
          feature,
          error: wrapped
        };
      } finally {
        completed += 1;
        request.onProgress?.({
          phase: 'feature',
          completed,
          total,
          feature
        });
      }
    });

    const taskResults = await Promise.all(tasks);
    for (const item of taskResults) {
      if (item.error) {
        errors[item.feature] = item.error;
      } else {
        results[item.feature] = item.data;
      }
    }
  } finally {
    fftProviderCache.clear();
  }

  return {
    meta: {
      sampleRate: scopedAudio.sampleRate,
      channels: scopedAudio.numberOfChannels,
      duration: scopedAudio.duration,
      length: scopedAudio.length,
      range: effectiveRange,
      totalElapsedMs: getPerformanceNow() - startedAt
    },
    results,
    errors
  };
}

export async function inspect<const F extends FeatureInput>(
  source: AudioSource,
  request: InspectRequest<F>
): Promise<InspectResult<SelectedFeatureIds<F>>> {
  const loadStarted = getPerformanceNow();
  throwIfAborted(request.signal);

  const loadOptions: LoadOptions = request.load ? { ...request.load } : {};
  if (request.signal) {
    loadOptions.signal = request.signal;
  }

  const loaded = await load(source, loadOptions);

  const loadElapsedMs = getPerformanceNow() - loadStarted;

  const analyzeRequest: AnalyzeRequest<F> = {
    features: request.features
  };

  if (request.range) {
    analyzeRequest.range = request.range;
  }
  if (request.continueOnError !== undefined) {
    analyzeRequest.continueOnError = request.continueOnError;
  }
  if (request.onProgress) {
    analyzeRequest.onProgress = request.onProgress;
  }
  if (request.signal) {
    analyzeRequest.signal = request.signal;
  }

  const analyzed = await analyze(loaded, analyzeRequest);

  return {
    ...analyzed,
    meta: {
      ...analyzed.meta,
      loadElapsedMs
    }
  };
}
