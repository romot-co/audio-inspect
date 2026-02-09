import {
  AudioData,
  AudioInspectError,
  type WindowFunction,
  type ChannelSelector
} from '../types.js';
import { type FFTProviderType, type FFTResult } from '../core/dsp/fft-provider.js';
import { acquireFFTProvider, type FFTProviderCache } from '../core/dsp/fft-runtime.js';
import { getChannelData } from '../core/utils.js';
import { ampToDb, dbToAmp } from '../core/dsp/db.js';
import { fillWindowedFrameInto } from '../core/dsp/window.js';

// FFT request parameters for single-frame analysis.
export interface FFTOptions {
  fftSize?: number;
  windowFunction?: WindowFunction;
  overlap?: number;
  channel?: ChannelSelector;
  provider?: FFTProviderType;
  enableProfiling?: boolean;
  providerCache?: FFTProviderCache | undefined;
}

// Spectrum request parameters for single frame or spectrogram analysis.
export interface SpectrumOptions extends FFTOptions {
  minFrequency?: number;
  maxFrequency?: number;
  decibels?: boolean;
  timeFrames?: number;
}

// Spectrogram payload returned from multi-frame spectrum analysis.
export interface SpectrogramData {
  times: Float32Array;
  frequencies: Float32Array;
  intensities: Float32Array[];
  timeFrames: number;
  frequencyBins: number;
}

// Extended FFT result with runtime metadata.
export interface FFTAnalysisResult extends FFTResult {
  fftSize: number;
  windowFunction: string;
  providerName: string;
}

// Spectrum result for one frame or a representative frame from a spectrogram.
export interface SpectrumAnalysisResult {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  decibels?: Float32Array;
  spectrogram?: SpectrogramData;
}

// Memoize in-flight FFT computations per-audio object and option tuple.
const fftResultCache = new WeakMap<AudioData, Map<string, Promise<FFTAnalysisResult>>>();

function serializeChannelSelector(channel: ChannelSelector): string {
  if (Array.isArray(channel)) {
    return `[${channel.map((value) => String(value)).join(',')}]`;
  }
  return String(channel);
}

function buildFFTCacheKey(
  options: Required<Pick<FFTOptions, 'fftSize' | 'windowFunction'>> & {
    channel: ChannelSelector;
    provider: FFTProviderType;
    enableProfiling: boolean;
  }
): string {
  return [
    options.fftSize,
    options.windowFunction,
    serializeChannelSelector(options.channel),
    options.provider,
    options.enableProfiling ? 1 : 0
  ].join('|');
}

// Vectorized helpers to keep call sites readable.
function magnitudeArrayToDecibels(magnitude: Float32Array): Float32Array {
  const decibels = new Float32Array(magnitude.length);
  for (let i = 0; i < magnitude.length; i++) {
    decibels[i] = ampToDb(magnitude[i] ?? 0, 1);
  }
  return decibels;
}

function decibelArrayToMagnitude(decibels: Float32Array): Float32Array {
  const magnitudes = new Float32Array(decibels.length);
  for (let i = 0; i < decibels.length; i++) {
    magnitudes[i] = dbToAmp(decibels[i] ?? -Infinity, 1);
  }
  return magnitudes;
}

// Trim FFT bins to the requested frequency range.
function filterFrequencyRange(fftResult: FFTResult, minFreq: number, maxFreq: number): FFTResult {
  const { frequencies, magnitude, phase, complex } = fftResult;

  let startIndex = frequencies.findIndex((freq) => freq >= minFreq);
  if (startIndex < 0) {
    startIndex = 0;
  }

  const endIndex = frequencies.findIndex((freq) => freq > maxFreq);
  const actualEnd = endIndex === -1 ? frequencies.length : endIndex;
  if (startIndex >= actualEnd) {
    return {
      frequencies: new Float32Array(0),
      magnitude: new Float32Array(0),
      phase: new Float32Array(0),
      complex: new Float32Array(0)
    };
  }

  return {
    frequencies: frequencies.slice(startIndex, actualEnd),
    magnitude: magnitude.slice(startIndex, actualEnd),
    phase: phase.slice(startIndex, actualEnd),
    complex: complex.slice(startIndex * 2, actualEnd * 2)
  };
}

// For spectrograms, expose the latest frame as representative magnitudes.
function resolveRepresentativeMagnitudes(
  spectrogram: SpectrogramData,
  asDecibels: boolean
): Float32Array {
  const latest = spectrogram.intensities[spectrogram.intensities.length - 1];
  if (!latest) {
    return new Float32Array(spectrogram.frequencyBins);
  }
  return asDecibels ? decibelArrayToMagnitude(latest) : latest.slice();
}

interface SpectrogramOptions {
  provider?: FFTProviderType;
  enableProfiling?: boolean;
  windowFunction?: WindowFunction;
  minFrequency?: number;
  maxFrequency?: number;
  decibels?: boolean;
  providerCache?: FFTProviderCache | undefined;
}

async function computeSpectrogram(
  data: Float32Array,
  sampleRate: number,
  fftSize: number,
  timeFrames: number,
  overlap: number,
  options: SpectrogramOptions
): Promise<SpectrogramData> {
  const hopSize = Math.floor(fftSize * (1 - overlap));
  if (hopSize <= 0) {
    throw new AudioInspectError('INVALID_INPUT', `Invalid overlap: ${overlap}`);
  }

  const numPossibleFrames =
    data.length === 0
      ? 0
      : data.length < fftSize
        ? 1
        : Math.floor((data.length - fftSize) / hopSize) + 1;
  const actualFrames = Math.min(timeFrames, numPossibleFrames);

  const times = new Float32Array(actualFrames);
  const intensities: Float32Array[] = [];
  let filteredFrequencies = new Float32Array(0);
  let frequencyStartIndex = 0;
  let frequencyEndIndex = 0;
  const frameBuffer = new Float32Array(fftSize);

  const { provider: fftProvider, release } = await acquireFFTProvider({
    fftSize,
    sampleRate,
    provider: options.provider ?? 'native',
    enableProfiling: options.enableProfiling ?? false,
    fallbackToNative: options.provider === 'webfft',
    cache: options.providerCache
  });

  try {
    for (let frame = 0; frame < actualFrames; frame++) {
      const startSample = frame * hopSize;
      const frameLength = Math.min(fftSize, Math.max(0, data.length - startSample));
      fillWindowedFrameInto({
        src: data,
        srcStart: startSample,
        frameLength,
        dst: frameBuffer,
        windowType: options.windowFunction ?? 'hann'
      });

      const fftResult = await fftProvider.fft(frameBuffer);
      if (frame === 0) {
        const minFreq = options.minFrequency ?? 0;
        const maxFreq = options.maxFrequency ?? sampleRate / 2;
        const frequencies = fftResult.frequencies;

        frequencyStartIndex = frequencies.findIndex((freq) => freq >= minFreq);
        if (frequencyStartIndex < 0) {
          frequencyStartIndex = 0;
        }

        const firstOutOfRange = frequencies.findIndex((freq) => freq > maxFreq);
        frequencyEndIndex = firstOutOfRange === -1 ? frequencies.length : firstOutOfRange;
        filteredFrequencies = frequencies.slice(frequencyStartIndex, frequencyEndIndex);
      }

      const filteredMagnitude = fftResult.magnitude.slice(frequencyStartIndex, frequencyEndIndex);
      intensities.push(
        options.decibels ? magnitudeArrayToDecibels(filteredMagnitude) : filteredMagnitude
      );
      times[frame] = (startSample + fftSize / 2) / sampleRate;
    }
  } finally {
    release();
  }

  return {
    times,
    frequencies: filteredFrequencies,
    intensities,
    timeFrames: actualFrames,
    frequencyBins: filteredFrequencies.length
  };
}

// Compute one FFT frame with shared provider/runtime caches.
export async function getFFT(
  audio: AudioData,
  options: FFTOptions = {}
): Promise<FFTAnalysisResult> {
  const {
    fftSize = 2048,
    windowFunction = 'hann',
    channel = 'mix',
    provider = 'native',
    enableProfiling = false,
    providerCache
  } = options;

  if (fftSize <= 0 || (fftSize & (fftSize - 1)) !== 0) {
    throw new AudioInspectError('INVALID_INPUT', 'FFT size must be a power of two');
  }

  const cacheKey = buildFFTCacheKey({
    fftSize,
    windowFunction,
    channel,
    provider,
    enableProfiling
  });
  let cacheEntry = fftResultCache.get(audio);
  if (!cacheEntry) {
    cacheEntry = new Map<string, Promise<FFTAnalysisResult>>();
    fftResultCache.set(audio, cacheEntry);
  }

  const cached = cacheEntry.get(cacheKey);
  if (cached) {
    return cached;
  }

  const computation = (async () => {
    const channelData = getChannelData(audio, channel);
    const frameBuffer = new Float32Array(fftSize);
    fillWindowedFrameInto({
      src: channelData,
      srcStart: 0,
      frameLength: Math.min(channelData.length, fftSize),
      dst: frameBuffer,
      windowType: windowFunction
    });

    const { provider: fftProvider, release } = await acquireFFTProvider({
      fftSize,
      sampleRate: audio.sampleRate,
      provider,
      enableProfiling,
      fallbackToNative: provider === 'webfft',
      cache: providerCache
    });

    try {
      const result = await fftProvider.fft(frameBuffer);
      return {
        ...result,
        fftSize,
        windowFunction,
        providerName: fftProvider.name
      };
    } finally {
      release();
    }
  })();

  cacheEntry.set(cacheKey, computation);
  const cleanup = () => {
    cacheEntry.delete(cacheKey);
    if (cacheEntry.size === 0) {
      fftResultCache.delete(audio);
    }
  };
  computation.then(cleanup, cleanup);
  return computation;
}

// Compute spectrum as one frame or a multi-frame spectrogram.
export async function getSpectrum(
  audio: AudioData,
  options: SpectrumOptions = {}
): Promise<SpectrumAnalysisResult> {
  const {
    fftSize = 2048,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    decibels = true,
    timeFrames = 1,
    overlap = 0.5,
    ...fftOptions
  } = options;

  const channelData = getChannelData(audio, options.channel ?? 'mix');

  if (timeFrames > 1 && (!Number.isFinite(overlap) || overlap < 0 || overlap >= 1)) {
    throw new AudioInspectError('INVALID_INPUT', 'overlap must be in [0, 1)');
  }

  if (timeFrames === 1) {
    const fftResult = await getFFT(audio, {
      ...fftOptions,
      fftSize
    });
    const filtered = filterFrequencyRange(fftResult, minFrequency, maxFrequency);
    const result: SpectrumAnalysisResult = {
      frequencies: filtered.frequencies,
      magnitudes: filtered.magnitude
    };

    if (decibels) {
      result.decibels = magnitudeArrayToDecibels(filtered.magnitude);
    }

    return result;
  }

  const spectrogramOptions: SpectrogramOptions = {
    minFrequency,
    maxFrequency,
    decibels
  };
  if (fftOptions.provider !== undefined) {
    spectrogramOptions.provider = fftOptions.provider;
  }
  if (fftOptions.enableProfiling !== undefined) {
    spectrogramOptions.enableProfiling = fftOptions.enableProfiling;
  }
  if (fftOptions.windowFunction !== undefined) {
    spectrogramOptions.windowFunction = fftOptions.windowFunction;
  }
  if (fftOptions.providerCache !== undefined) {
    spectrogramOptions.providerCache = fftOptions.providerCache;
  }

  const spectrogram = await computeSpectrogram(
    channelData,
    audio.sampleRate,
    fftSize,
    timeFrames,
    overlap,
    spectrogramOptions
  );

  const result: SpectrumAnalysisResult = {
    frequencies: spectrogram.frequencies,
    magnitudes: resolveRepresentativeMagnitudes(spectrogram, decibels),
    spectrogram
  };

  if (decibels) {
    const latestDecibels = spectrogram.intensities[spectrogram.intensities.length - 1];
    if (latestDecibels) {
      result.decibels = latestDecibels;
    }
  }

  return result;
}
