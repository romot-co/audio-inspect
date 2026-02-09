import {
  AudioData,
  AudioInspectError,
  type WindowFunction,
  type ChannelSelector
} from '../types.js';
import { type FFTProviderType, type FFTResult } from '../core/dsp/fft-provider.js';
import { acquireFFTProvider, type FFTProviderCache } from '../core/dsp/fft-runtime.js';
import { getChannelData } from '../core/utils.js';
import { ampToDb } from '../core/dsp/db.js';
import { fillWindowedFrameInto, getWindow } from '../core/dsp/window.js';

export type FFTNormalization = 'none' | 'amplitude';
export type SpectrumScale = 'amplitude' | 'dbfs';

// FFT request parameters for single-frame analysis.
export interface FFTOptions {
  fftSize?: number;
  windowFunction?: WindowFunction;
  channel?: ChannelSelector;
  provider?: FFTProviderType;
  enableProfiling?: boolean;
  providerCache?: FFTProviderCache | undefined;
  normalization?: FFTNormalization;
}

// Spectrum request parameters for one frame.
export interface SpectrumOptions extends FFTOptions {
  minFrequency?: number;
  maxFrequency?: number;
  scale?: SpectrumScale;
}

// Spectrogram request parameters for frame-sequence analysis.
export interface SpectrogramOptions extends SpectrumOptions {
  frameSize?: number;
  hopSize?: number;
  maxFrames?: number;
}

// Extended FFT result with runtime metadata.
export interface FFTAnalysisResult extends FFTResult {
  fftSize: number;
  windowFunction: string;
  providerName: string;
  normalization: FFTNormalization;
}

// One-frame spectrum output with explicit unit scale.
export interface SpectrumAnalysisResult {
  frequencies: Float32Array;
  values: Float32Array;
  scale: SpectrumScale;
}

// Frame-sequence spectrum output for offline and realtime.
export interface SpectrogramAnalysisResult {
  times: Float32Array;
  frequencies: Float32Array;
  frames: Float32Array[];
  frameCount: number;
  frequencyBins: number;
  scale: SpectrumScale;
  latest: Float32Array;
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
  options: Required<Pick<FFTOptions, 'fftSize' | 'windowFunction' | 'normalization'>> & {
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
    options.enableProfiling ? 1 : 0,
    options.normalization
  ].join('|');
}

function assertPowerOfTwo(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0 || (value & (value - 1)) !== 0) {
    throw new AudioInspectError('INVALID_INPUT', `${name} must be a power of two`);
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AudioInspectError('INVALID_INPUT', `${name} must be a positive integer`);
  }
}

function assertFrequencyRange(
  sampleRate: number,
  minFrequency: number,
  maxFrequency: number
): void {
  if (!Number.isFinite(minFrequency) || !Number.isFinite(maxFrequency) || minFrequency < 0) {
    throw new AudioInspectError(
      'INVALID_INPUT',
      `Invalid frequency range: min=${minFrequency}, max=${maxFrequency}`
    );
  }

  const nyquist = sampleRate / 2;
  if (minFrequency >= maxFrequency || maxFrequency > nyquist) {
    throw new AudioInspectError(
      'INVALID_INPUT',
      `Frequency range must satisfy 0 <= min < max <= Nyquist (${nyquist})`
    );
  }
}

function resolveFrequencyBounds(
  frequencies: Float32Array,
  minFrequency: number,
  maxFrequency: number
): { startIndex: number; endIndex: number } {
  let startIndex = frequencies.findIndex((freq) => freq >= minFrequency);
  if (startIndex < 0) {
    startIndex = 0;
  }

  const firstOutOfRange = frequencies.findIndex((freq) => freq > maxFrequency);
  const endIndex = firstOutOfRange === -1 ? frequencies.length : firstOutOfRange;
  if (startIndex >= endIndex) {
    return { startIndex: 0, endIndex: 0 };
  }

  return { startIndex, endIndex };
}

function computeCoherentGain(windowFunction: WindowFunction, frameLength: number): number {
  if (frameLength <= 1 || windowFunction === 'none') {
    return 1;
  }

  const window = getWindow(frameLength, windowFunction);
  let sum = 0;
  for (let i = 0; i < window.length; i++) {
    sum += window[i] ?? 0;
  }

  const gain = sum / frameLength;
  return gain > 0 ? gain : 1;
}

function normalizeMagnitudeInPlace(
  magnitude: Float32Array,
  normalization: FFTNormalization,
  frameLength: number,
  windowFunction: WindowFunction
): Float32Array {
  if (normalization === 'none') {
    return magnitude;
  }

  if (frameLength <= 0 || magnitude.length === 0) {
    magnitude.fill(0);
    return magnitude;
  }

  const coherentGain = computeCoherentGain(windowFunction, frameLength);
  const denominator = frameLength * coherentGain;
  if (denominator <= 0) {
    magnitude.fill(0);
    return magnitude;
  }

  const edgeScale = 1 / denominator;
  const interiorScale = edgeScale * 2;
  const nyquistIndex = magnitude.length - 1;

  for (let i = 0; i < magnitude.length; i++) {
    const scale = i === 0 || i === nyquistIndex ? edgeScale : interiorScale;
    magnitude[i] = (magnitude[i] ?? 0) * scale;
  }

  return magnitude;
}

function magnitudeToScale(magnitude: Float32Array, scale: SpectrumScale): Float32Array {
  if (scale === 'amplitude') {
    return magnitude.slice();
  }

  const values = new Float32Array(magnitude.length);
  for (let i = 0; i < magnitude.length; i++) {
    values[i] = ampToDb(magnitude[i] ?? 0, 1);
  }
  return values;
}

function frameCountForLength(dataLength: number, frameSize: number, hopSize: number): number {
  if (dataLength === 0) {
    return 0;
  }
  if (dataLength < frameSize) {
    return 1;
  }
  return Math.floor((dataLength - frameSize) / hopSize) + 1;
}

function assertScaleNormalizationCompatibility(
  scale: SpectrumScale,
  normalization: FFTNormalization
): void {
  if (scale === 'dbfs' && normalization !== 'amplitude') {
    throw new AudioInspectError('INVALID_INPUT', 'scale="dbfs" requires normalization="amplitude"');
  }
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
    providerCache,
    normalization = 'amplitude'
  } = options;

  assertPowerOfTwo(fftSize, 'FFT size');

  const cacheKey = buildFFTCacheKey({
    fftSize,
    windowFunction,
    channel,
    provider,
    enableProfiling,
    normalization
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
    const frameLength = Math.min(channelData.length, fftSize);
    fillWindowedFrameInto({
      src: channelData,
      srcStart: 0,
      frameLength,
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
      const magnitude = new Float32Array(result.magnitude);
      normalizeMagnitudeInPlace(magnitude, normalization, frameLength, windowFunction);

      return {
        ...result,
        magnitude,
        fftSize,
        windowFunction,
        providerName: fftProvider.name,
        normalization
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

// Compute one spectrum frame with fixed output scale.
export async function getSpectrum(
  audio: AudioData,
  options: SpectrumOptions = {}
): Promise<SpectrumAnalysisResult> {
  const {
    fftSize = 2048,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    scale = 'dbfs',
    normalization = 'amplitude',
    ...fftOptions
  } = options;

  assertFrequencyRange(audio.sampleRate, minFrequency, maxFrequency);
  assertScaleNormalizationCompatibility(scale, normalization);

  const fftResult = await getFFT(audio, {
    ...fftOptions,
    fftSize,
    normalization
  });

  const { startIndex, endIndex } = resolveFrequencyBounds(
    fftResult.frequencies,
    minFrequency,
    maxFrequency
  );
  const filteredFrequencies = fftResult.frequencies.slice(startIndex, endIndex);
  const filteredMagnitude = fftResult.magnitude.slice(startIndex, endIndex);

  return {
    frequencies: filteredFrequencies,
    values: magnitudeToScale(filteredMagnitude, scale),
    scale
  };
}

// Compute a spectrogram from a frame sequence.
export async function getSpectrogram(
  audio: AudioData,
  options: SpectrogramOptions = {}
): Promise<SpectrogramAnalysisResult> {
  const {
    fftSize = 2048,
    frameSize = fftSize,
    hopSize = Math.max(1, Math.floor(frameSize / 2)),
    maxFrames,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    scale = 'dbfs',
    normalization = 'amplitude',
    windowFunction = 'hann',
    channel = 'mix',
    provider = 'native',
    enableProfiling = false,
    providerCache
  } = options;

  assertPowerOfTwo(fftSize, 'FFT size');
  assertPositiveInteger(frameSize, 'frameSize');
  assertPositiveInteger(hopSize, 'hopSize');
  if (frameSize > fftSize) {
    throw new AudioInspectError('INVALID_INPUT', 'frameSize must be <= fftSize');
  }
  if (maxFrames !== undefined) {
    assertPositiveInteger(maxFrames, 'maxFrames');
  }

  assertFrequencyRange(audio.sampleRate, minFrequency, maxFrequency);
  assertScaleNormalizationCompatibility(scale, normalization);

  const data = getChannelData(audio, channel);
  const possibleFrameCount = frameCountForLength(data.length, frameSize, hopSize);
  const frameCount =
    maxFrames === undefined ? possibleFrameCount : Math.min(possibleFrameCount, maxFrames);

  if (frameCount === 0) {
    return {
      times: new Float32Array(0),
      frequencies: new Float32Array(0),
      frames: [],
      frameCount: 0,
      frequencyBins: 0,
      scale,
      latest: new Float32Array(0)
    };
  }

  const times = new Float32Array(frameCount);
  const frames: Float32Array[] = new Array<Float32Array>(frameCount);
  const frameBuffer = new Float32Array(fftSize);

  let filteredFrequencies = new Float32Array(0);
  let frequencyStartIndex = 0;
  let frequencyEndIndex = 0;

  const { provider: fftProvider, release } = await acquireFFTProvider({
    fftSize,
    sampleRate: audio.sampleRate,
    provider,
    enableProfiling,
    fallbackToNative: provider === 'webfft',
    cache: providerCache
  });

  try {
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const startSample = frameIndex * hopSize;
      const frameLength = Math.min(frameSize, Math.max(0, data.length - startSample));
      fillWindowedFrameInto({
        src: data,
        srcStart: startSample,
        frameLength,
        dst: frameBuffer,
        windowType: windowFunction
      });

      const fftResult = await fftProvider.fft(frameBuffer);
      const magnitude = new Float32Array(fftResult.magnitude);
      normalizeMagnitudeInPlace(magnitude, normalization, frameLength, windowFunction);

      if (frameIndex === 0) {
        const range = resolveFrequencyBounds(fftResult.frequencies, minFrequency, maxFrequency);
        frequencyStartIndex = range.startIndex;
        frequencyEndIndex = range.endIndex;
        filteredFrequencies = fftResult.frequencies.slice(frequencyStartIndex, frequencyEndIndex);
      }

      const filteredMagnitude = magnitude.slice(frequencyStartIndex, frequencyEndIndex);
      frames[frameIndex] = magnitudeToScale(filteredMagnitude, scale);
      times[frameIndex] = (startSample + frameSize / 2) / audio.sampleRate;
    }
  } finally {
    release();
  }

  const latest = frames[frames.length - 1] ?? new Float32Array(filteredFrequencies.length);

  return {
    times,
    frequencies: filteredFrequencies,
    frames,
    frameCount: frames.length,
    frequencyBins: filteredFrequencies.length,
    scale,
    latest
  };
}
