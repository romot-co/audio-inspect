import {
  AudioData,
  AudioInspectError,
  type WindowFunction,
  type ChannelSelector
} from '../types.js';
import { getChannelData, nextPowerOfTwo } from '../core/utils.js';
import { type FFTProviderType } from '../core/dsp/fft-provider.js';
import { acquireFFTProvider, type FFTProviderCache } from '../core/dsp/fft-runtime.js';
import { ampToDb } from '../core/dsp/db.js';
import { fillWindowedFrameInto } from '../core/dsp/window.js';
import { getFFT } from './frequency.js';

interface SpectralRuntimeOptions {
  // FFT backend used for spectral analysis.
  provider?: FFTProviderType;
  // Enables provider-specific profiling where supported.
  enableProfiling?: boolean;
  // Optional shared provider cache to avoid repeated allocations.
  providerCache?: FFTProviderCache | undefined;
}

// Spectral descriptors computed from a single FFT frame.
export interface SpectralFeaturesOptions extends SpectralRuntimeOptions {
  fftSize?: number;
  windowFunction?: 'hann' | 'hamming' | 'blackman' | 'none';
  channel?: ChannelSelector;
  minFrequency?: number;
  maxFrequency?: number;
  rolloffThreshold?: number;
}

export interface SpectralFeaturesResult {
  spectralCentroid: number;
  spectralBandwidth: number;
  spectralRolloff: number;
  spectralFlatness: number;
  spectralFlux?: number;
  zeroCrossingRate: number;
  frequencyRange: { min: number; max: number };
}

// Time-series spectral descriptors over framed analysis windows.
export interface TimeVaryingSpectralOptions extends SpectralFeaturesOptions {
  frameSize?: number;
  hopSize?: number;
  numFrames?: number;
}

export interface TimeVaryingSpectralResult {
  times: Float32Array;
  spectralCentroid: Float32Array;
  spectralBandwidth: Float32Array;
  spectralRolloff: Float32Array;
  spectralFlatness: Float32Array;
  spectralFlux: Float32Array;
  zeroCrossingRate: Float32Array;
  frameInfo: {
    frameSize: number;
    hopSize: number;
    numFrames: number;
  };
}

export interface SpectralEntropyOptions extends SpectralRuntimeOptions {
  fftSize?: number;
  windowFunction?: 'hann' | 'hamming' | 'blackman' | 'none';
  channel?: ChannelSelector;
  minFrequency?: number;
  maxFrequency?: number;
}

export interface SpectralEntropyResult {
  entropy: number;
  entropyNorm: number;
  frequencyRange: { min: number; max: number };
}

export interface SpectralCrestOptions extends SpectralRuntimeOptions {
  fftSize?: number;
  windowFunction?: 'hann' | 'hamming' | 'blackman' | 'none';
  channel?: ChannelSelector;
  minFrequency?: number;
  maxFrequency?: number;
  asDB?: boolean;
}

export interface SpectralCrestResult {
  crest: number;
  crestDB?: number;
  peak: number;
  average: number;
  frequencyRange: { min: number; max: number };
}

// Frequency centroid weighted by linear magnitude.
function calculateSpectralCentroid(
  magnitude: Float32Array,
  frequencies: Float32Array,
  minFreq: number,
  maxFreq: number
): number {
  let weightedSum = 0;
  let magnitudeSum = 0;

  for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
    const freq = frequencies[i]!;
    const mag = magnitude[i]!;
    if (freq >= minFreq && freq <= maxFreq) {
      weightedSum += freq * mag;
      magnitudeSum += mag;
    }
  }

  return magnitudeSum > 1e-10 ? weightedSum / magnitudeSum : 0;
}

// Spread around the spectral centroid.
function calculateSpectralBandwidth(
  magnitude: Float32Array,
  frequencies: Float32Array,
  centroid: number,
  minFreq: number,
  maxFreq: number
): number {
  let weightedVarianceSum = 0;
  let magnitudeSum = 0;

  for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
    const freq = frequencies[i]!;
    const mag = magnitude[i]!;
    if (freq >= minFreq && freq <= maxFreq) {
      const deviation = freq - centroid;
      weightedVarianceSum += deviation * deviation * mag;
      magnitudeSum += mag;
    }
  }

  return magnitudeSum > 1e-10 ? Math.sqrt(weightedVarianceSum / magnitudeSum) : 0;
}

// Frequency where cumulative energy reaches the given threshold.
function calculateSpectralRolloff(
  magnitude: Float32Array,
  frequencies: Float32Array,
  threshold: number,
  minFreq: number,
  maxFreq: number
): number {
  // Use power domain for rolloff energy accumulation.
  let totalEnergy = 0;
  for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
    const freq = frequencies[i]!;
    const mag = magnitude[i]!;
    if (freq >= minFreq && freq <= maxFreq) {
      totalEnergy += mag * mag;
    }
  }

  const targetEnergy = totalEnergy * threshold;
  let cumulativeEnergy = 0;

  for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
    const freq = frequencies[i]!;
    const mag = magnitude[i]!;
    if (freq >= minFreq && freq <= maxFreq) {
      cumulativeEnergy += mag * mag;
      if (cumulativeEnergy >= targetEnergy) {
        return freq;
      }
    }
  }

  return maxFreq;
}

// Spectral flatness as geometric mean / arithmetic mean.
function calculateSpectralFlatness(
  magnitude: Float32Array,
  minIndex: number,
  maxIndex: number
): number {
  let geometricMean = 0;
  let arithmeticMean = 0;
  let count = 0;

  for (let i = minIndex; i <= maxIndex && i < magnitude.length; i++) {
    const safeMag = Math.max(magnitude[i]!, 1e-10);
    geometricMean += Math.log(safeMag);
    arithmeticMean += safeMag;
    count++;
  }

  if (count === 0) return 0;

  geometricMean = Math.exp(geometricMean / count);
  arithmeticMean = arithmeticMean / count;

  return arithmeticMean > 1e-10 ? geometricMean / arithmeticMean : 0;
}

// Zero-crossing rate in normalized crossings per sample.
function calculateZeroCrossingRate(samples: Float32Array): number {
  if (samples.length < 2) return 0;

  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1]!;
    const curr = samples[i]!;

    if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
      crossings++;
    }
  }

  return crossings / (samples.length - 1);
}

// Spectral flux between adjacent frames.
function calculateSpectralFlux(
  currentMagnitude: Float32Array,
  previousMagnitude?: Float32Array,
  options: { normalize?: boolean } = { normalize: true }
): number {
  if (!previousMagnitude || previousMagnitude.length === 0) {
    return 0;
  }

  const length = Math.min(currentMagnitude.length, previousMagnitude.length);

  if (length === 0) {
    return 0;
  }

  if (options.normalize !== false) {
    // Normalize vectors before differencing for level-invariant flux.
    let currentNormSq = 0;
    let previousNormSq = 0;

    for (let i = 0; i < length; i++) {
      const curr = currentMagnitude[i]!;
      const prev = previousMagnitude[i]!;
      currentNormSq += curr * curr;
      previousNormSq += prev * prev;
    }

    const currentNorm = Math.sqrt(currentNormSq);
    const previousNorm = Math.sqrt(previousNormSq);

    if (currentNorm > 1e-10 && previousNorm > 1e-10) {
      const currentScale = 1 / currentNorm;
      const previousScale = 1 / previousNorm;
      let flux = 0;
      for (let i = 0; i < length; i++) {
        const diff = currentMagnitude[i]! * currentScale - previousMagnitude[i]! * previousScale;
        flux += diff * diff;
      }
      return Math.sqrt(flux);
    }
  }

  // Fallback: raw Euclidean difference.
  let flux = 0;

  for (let i = 0; i < length; i++) {
    const diff = currentMagnitude[i]! - previousMagnitude[i]!;
    flux += diff * diff;
  }

  return Math.sqrt(flux);
}

// Compute single-frame spectral descriptors.
export async function getSpectralFeatures(
  audio: AudioData,
  options: SpectralFeaturesOptions = {}
): Promise<SpectralFeaturesResult> {
  const {
    fftSize = 2048,
    windowFunction = 'hann',
    channel = 'mix',
    provider = 'native',
    enableProfiling = false,
    providerCache,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    rolloffThreshold = 0.85
  } = options;
  const samples = getChannelData(audio, channel);

  const fftResult = await getFFT(audio, {
    fftSize,
    windowFunction,
    channel,
    provider,
    enableProfiling,
    providerCache
  });

  const minIndex = Math.max(0, Math.floor((minFrequency * fftSize) / audio.sampleRate));
  const maxIndex = Math.min(
    fftResult.frequencies.length - 1,
    Math.floor((maxFrequency * fftSize) / audio.sampleRate)
  );

  const spectralCentroid = calculateSpectralCentroid(
    fftResult.magnitude,
    fftResult.frequencies,
    minFrequency,
    maxFrequency
  );

  const spectralBandwidth = calculateSpectralBandwidth(
    fftResult.magnitude,
    fftResult.frequencies,
    spectralCentroid,
    minFrequency,
    maxFrequency
  );

  const spectralRolloff = calculateSpectralRolloff(
    fftResult.magnitude,
    fftResult.frequencies,
    rolloffThreshold,
    minFrequency,
    maxFrequency
  );

  const spectralFlatness = calculateSpectralFlatness(fftResult.magnitude, minIndex, maxIndex);

  const zeroCrossingRate = calculateZeroCrossingRate(samples);

  return {
    spectralCentroid,
    spectralBandwidth,
    spectralRolloff,
    spectralFlatness,
    spectralFlux: 0,
    zeroCrossingRate,
    frequencyRange: {
      min: minFrequency,
      max: maxFrequency
    }
  };
}

// Compute frame-wise spectral descriptor time series.
export async function getTimeVaryingSpectralFeatures(
  audio: AudioData,
  options: TimeVaryingSpectralOptions = {}
): Promise<TimeVaryingSpectralResult> {
  const {
    frameSize = 2048,
    hopSize = frameSize / 2,
    fftSize = frameSize,
    windowFunction = 'hann',
    channel = 'mix',
    provider = 'native',
    enableProfiling = false,
    providerCache,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    rolloffThreshold = 0.85,
    numFrames
  } = options;
  const samples = getChannelData(audio, channel);

  const computedFrames = Math.floor((samples.length - frameSize) / hopSize) + 1;
  const totalFrames = numFrames ?? (samples.length > 0 ? Math.max(1, computedFrames) : 0);

  if (totalFrames <= 0 || samples.length === 0) {
    throw new AudioInspectError('INVALID_INPUT', 'Invalid frame count');
  }

  // Allocate output vectors and reusable scratch frame.
  const times = new Float32Array(totalFrames);
  const spectralCentroid = new Float32Array(totalFrames);
  const spectralBandwidth = new Float32Array(totalFrames);
  const spectralRolloff = new Float32Array(totalFrames);
  const spectralFlatness = new Float32Array(totalFrames);
  const spectralFlux = new Float32Array(totalFrames);
  const zeroCrossingRate = new Float32Array(totalFrames);
  const windowedFrame = new Float32Array(fftSize);

  let previousMagnitude: Float32Array | undefined;

  const { provider: fftProvider, release } = await acquireFFTProvider({
    fftSize,
    sampleRate: audio.sampleRate,
    provider,
    enableProfiling,
    fallbackToNative: provider === 'webfft',
    cache: providerCache
  });

  try {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const startSample = frameIndex * hopSize;
      const endSample = Math.min(startSample + frameSize, samples.length);

      times[frameIndex] = startSample / audio.sampleRate;

      const frameData = samples.subarray(startSample, endSample);
      fillWindowedFrameInto({
        src: samples,
        srcStart: startSample,
        frameLength: Math.min(frameSize, Math.max(0, samples.length - startSample)),
        dst: windowedFrame,
        windowType: windowFunction
      });

      const fftResult = await fftProvider.fft(windowedFrame);

      const minIndex = Math.max(0, Math.floor((minFrequency * fftSize) / audio.sampleRate));
      const maxIndex = Math.min(
        fftResult.frequencies.length - 1,
        Math.floor((maxFrequency * fftSize) / audio.sampleRate)
      );

      const centroid = calculateSpectralCentroid(
        fftResult.magnitude,
        fftResult.frequencies,
        minFrequency,
        maxFrequency
      );
      spectralCentroid[frameIndex] = centroid;
      spectralBandwidth[frameIndex] = calculateSpectralBandwidth(
        fftResult.magnitude,
        fftResult.frequencies,
        centroid,
        minFrequency,
        maxFrequency
      );
      spectralRolloff[frameIndex] = calculateSpectralRolloff(
        fftResult.magnitude,
        fftResult.frequencies,
        rolloffThreshold,
        minFrequency,
        maxFrequency
      );
      spectralFlatness[frameIndex] = calculateSpectralFlatness(
        fftResult.magnitude,
        minIndex,
        maxIndex
      );
      zeroCrossingRate[frameIndex] = calculateZeroCrossingRate(frameData);

      spectralFlux[frameIndex] = calculateSpectralFlux(fftResult.magnitude, previousMagnitude);
      previousMagnitude = new Float32Array(fftResult.magnitude);
    }
  } finally {
    release();
  }

  return {
    times,
    spectralCentroid,
    spectralBandwidth,
    spectralRolloff,
    spectralFlatness,
    spectralFlux,
    zeroCrossingRate,
    frameInfo: {
      frameSize,
      hopSize,
      numFrames: totalFrames
    }
  };
}

// Shannon entropy over normalized spectral power.
function calculateSpectralEntropy(
  magnitude: Float32Array,
  minIndex: number,
  maxIndex: number
): { entropy: number; entropyNorm: number } {
  const powers = [];
  let totalPower = 0;

  for (let i = minIndex; i <= maxIndex && i < magnitude.length; i++) {
    const mag = magnitude[i];
    if (mag !== undefined) {
      const power = mag * mag;
      powers.push(power);
      totalPower += power;
    }
  }

  if (powers.length === 0 || totalPower <= 1e-10) {
    return { entropy: 0, entropyNorm: 0 };
  }

  const probabilities = powers.map((p) => p / totalPower);

  let entropy = 0;
  for (const p of probabilities) {
    if (p > 1e-10) {
      entropy -= p * Math.log2(p);
    }
  }

  const maxEntropy = Math.log2(powers.length);
  const entropyNorm = maxEntropy > 0 ? entropy / maxEntropy : 0;

  return { entropy, entropyNorm };
}

// Crest factor in the spectral domain.
function calculateSpectralCrest(
  magnitude: Float32Array,
  minIndex: number,
  maxIndex: number
): { crest: number; peak: number; average: number } {
  let peak = 0;
  let sum = 0;
  let count = 0;

  for (let i = minIndex; i <= maxIndex && i < magnitude.length; i++) {
    const mag = magnitude[i];
    if (mag !== undefined) {
      peak = Math.max(peak, mag);
      sum += mag;
      count++;
    }
  }

  if (count === 0) {
    return { crest: 0, peak: 0, average: 0 };
  }

  const average = sum / count;
  const crest = average > 1e-10 ? peak / average : 0;

  return { crest, peak, average };
}

// Compute spectral entropy over a frequency range.
export async function getSpectralEntropy(
  audio: AudioData,
  options: SpectralEntropyOptions = {}
): Promise<SpectralEntropyResult> {
  const {
    fftSize = 2048,
    windowFunction = 'hann',
    channel = 'mix',
    provider = 'native',
    enableProfiling = false,
    providerCache,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2
  } = options;

  const fftResult = await getFFT(audio, {
    fftSize,
    windowFunction,
    channel,
    provider,
    enableProfiling,
    providerCache
  });

  const minIndex = Math.max(0, Math.floor((minFrequency * fftSize) / audio.sampleRate));
  const maxIndex = Math.min(
    fftResult.frequencies.length - 1,
    Math.floor((maxFrequency * fftSize) / audio.sampleRate)
  );

  const { entropy, entropyNorm } = calculateSpectralEntropy(
    fftResult.magnitude,
    minIndex,
    maxIndex
  );

  return {
    entropy,
    entropyNorm,
    frequencyRange: {
      min: minFrequency,
      max: maxFrequency
    }
  };
}

// Compute spectral crest factor over a frequency range.
export async function getSpectralCrest(
  audio: AudioData,
  options: SpectralCrestOptions = {}
): Promise<SpectralCrestResult> {
  const {
    fftSize = 2048,
    windowFunction = 'hann',
    channel = 'mix',
    provider = 'native',
    enableProfiling = false,
    providerCache,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    asDB = false
  } = options;

  const fftResult = await getFFT(audio, {
    fftSize,
    windowFunction,
    channel,
    provider,
    enableProfiling,
    providerCache
  });

  const minIndex = Math.max(0, Math.floor((minFrequency * fftSize) / audio.sampleRate));
  const maxIndex = Math.min(
    fftResult.frequencies.length - 1,
    Math.floor((maxFrequency * fftSize) / audio.sampleRate)
  );

  const { crest, peak, average } = calculateSpectralCrest(fftResult.magnitude, minIndex, maxIndex);

  const result: SpectralCrestResult = {
    crest,
    peak,
    average,
    frequencyRange: {
      min: minFrequency,
      max: maxFrequency
    }
  };

  if (asDB) {
    result.crestDB = ampToDb(crest, 1);
  }

  return result;
}

interface FramedTransformOptions extends SpectralRuntimeOptions {
  // Frame length for transforms in milliseconds.
  frameSizeMs?: number;
  // Hop length for transforms in milliseconds.
  hopSizeMs?: number;
  // FFT size (typically >= frameSizeSamples).
  fftSize?: number;
  // Window function applied to each frame.
  windowFunction?: WindowFunction;
  // Target channel selector.
  channel?: ChannelSelector;
}

export interface MelSpectrogramOptions extends FramedTransformOptions {
  numMelFilters?: number;
  minFrequency?: number;
  maxFrequency?: number;
  preEmphasis?: number;
  power?: 1 | 2;
  logScale?: boolean;
  logEpsilon?: number;
}

export interface MelSpectrogramResult {
  melSpectrogram: number[][];
  times: Float32Array;
  melFrequencies: Float32Array;
  frameInfo: {
    frameSizeMs: number;
    hopSizeMs: number;
    numFrames: number;
    numBins: number;
  };
  frequencyRange: { min: number; max: number };
}

export interface CQTOptions extends FramedTransformOptions {
  fMin?: number;

  binsPerOctave?: number;

  numBins?: number;

  preEmphasis?: number;

  power?: 1 | 2;

  logScale?: boolean;

  logEpsilon?: number;
}

export interface CQTResult {
  cqt: number[][];

  times: Float32Array;

  frequencies: Float32Array;

  frameInfo: {
    frameSizeMs: number;
    hopSizeMs: number;
    numFrames: number;
    numBins: number;
    binsPerOctave: number;
  };

  frequencyRange: { min: number; max: number };
}

interface FrameTransformConfig {
  frameSizeMs: number;
  hopSizeMs: number;
  frameSizeSamples: number;
  hopSizeSamples: number;
  fftSize: number;
  windowFunction: WindowFunction;
  channel: ChannelSelector;
  numFrames: number;
}

interface MelFilterBank {
  filters: Float32Array[];
  centerFrequencies: Float32Array;
}

interface CQTBand {
  centerFrequency: number;
  lowerFrequency: number;
  upperFrequency: number;
  startIndex: number;
  endIndex: number;
}

const melFilterBankCache = new Map<string, MelFilterBank>();
const cqtBandCache = new Map<string, CQTBand[]>();

function createMelFilterBankKey(
  numFilters: number,
  fftSize: number,
  sampleRate: number,
  minFreq: number,
  maxFreq: number
): string {
  return `${numFilters}|${fftSize}|${sampleRate}|${minFreq}|${maxFreq}`;
}

function createCqtBandsKey(
  fftSize: number,
  sampleRate: number,
  fMin: number,
  binsPerOctave: number,
  numBins: number | undefined
): string {
  return `${fftSize}|${sampleRate}|${fMin}|${binsPerOctave}|${numBins ?? 'auto'}`;
}

export interface MFCCOptions extends FramedTransformOptions {
  numMelFilters?: number;

  numMfccCoeffs?: number;

  minFrequency?: number;

  maxFrequency?: number;

  preEmphasis?: number;

  lifterCoeff?: number;
}

export interface MFCCResult {
  mfcc: number[][];

  times: Float32Array;

  frameInfo: {
    frameSizeMs: number;
    hopSizeMs: number;
    numFrames: number;
    numCoeffs: number;
  };

  frequencyRange: { min: number; max: number };
}

function hzToMel(freq: number): number {
  return 2595 * Math.log10(1 + freq / 700);
}

function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

function createMelFilterBank(
  numFilters: number,
  fftSize: number,
  sampleRate: number,
  minFreq: number,
  maxFreq: number
): MelFilterBank {
  const cacheKey = createMelFilterBankKey(numFilters, fftSize, sampleRate, minFreq, maxFreq);
  const cached = melFilterBankCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const filters: Float32Array[] = [];
  const nyquist = sampleRate / 2;
  const numBins = Math.floor(fftSize / 2) + 1;

  const minMel = hzToMel(minFreq);
  const maxMel = hzToMel(maxFreq);
  const melPoints = new Array<number>(numFilters + 2);

  for (let i = 0; i < numFilters + 2; i++) {
    melPoints[i] = minMel + ((maxMel - minMel) * i) / (numFilters + 1);
  }
  const centerFrequencies = new Float32Array(numFilters);

  const binPoints = melPoints.map((mel) => {
    const freq = melToHz(mel);
    return Math.floor((freq / nyquist) * (numBins - 1));
  });

  for (let i = 1; i <= numFilters; i++) {
    const filter = new Float32Array(numBins);
    const left = binPoints[i - 1];
    const center = binPoints[i];
    const right = binPoints[i + 1];

    if (left === undefined || center === undefined || right === undefined) {
      continue;
    }
    const centerMel = melPoints[i];
    if (centerMel !== undefined) {
      centerFrequencies[i - 1] = melToHz(centerMel);
    }

    for (let j = left; j <= right; j++) {
      if (j < 0 || j >= numBins || j >= filter.length) continue;

      if (j < center) {
        if (center - left > 0) {
          filter[j] = (j - left) / (center - left);
        }
      } else {
        if (right - center > 0) {
          filter[j] = (right - j) / (right - center);
        }
      }
    }

    filters.push(filter);
  }

  const created = {
    filters,
    centerFrequencies
  };
  melFilterBankCache.set(cacheKey, created);
  return created;
}

function resolveFrameTransformConfig(
  audio: AudioData,
  sampleLength: number,
  options: FramedTransformOptions,
  defaultWindowFunction: WindowFunction
): FrameTransformConfig {
  const frameSizeMs = options.frameSizeMs ?? 25;
  const hopSizeMs = options.hopSizeMs ?? 10;
  const frameSizeSamples = Math.round((frameSizeMs / 1000) * audio.sampleRate);
  const hopSizeSamples = Math.round((hopSizeMs / 1000) * audio.sampleRate);
  const fftSize = options.fftSize ?? Math.max(1024, nextPowerOfTwo(frameSizeSamples));

  if (frameSizeSamples <= 0 || hopSizeSamples <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'Frame size or hop size is too small');
  }

  if (fftSize <= 0 || (fftSize & (fftSize - 1)) !== 0) {
    throw new AudioInspectError('INVALID_INPUT', 'FFT size must be a power of two');
  }

  const numFrames = Math.floor((sampleLength - frameSizeSamples) / hopSizeSamples) + 1;
  if (numFrames <= 0) {
    throw new AudioInspectError('INSUFFICIENT_DATA', 'Invalid frame count');
  }

  return {
    frameSizeMs,
    hopSizeMs,
    frameSizeSamples,
    hopSizeSamples,
    fftSize,
    windowFunction: options.windowFunction ?? defaultWindowFunction,
    channel: options.channel ?? 'mix',
    numFrames
  };
}

function computeSpectrumPower(magnitude: Float32Array, power: 1 | 2): Float32Array {
  const values = new Float32Array(magnitude.length);
  if (power === 1) {
    values.set(magnitude);
    return values;
  }

  for (let i = 0; i < magnitude.length; i++) {
    const mag = magnitude[i]!;
    values[i] = mag * mag;
  }

  return values;
}

function applyMelFilterBank(
  spectrumValues: Float32Array,
  melFilters: Float32Array[],
  floor: number
): Float32Array {
  const melValues = new Float32Array(melFilters.length);

  for (let i = 0; i < melFilters.length; i++) {
    const filter = melFilters[i];
    if (!filter) continue;

    let sum = 0;
    for (let j = 0; j < filter.length && j < spectrumValues.length; j++) {
      sum += spectrumValues[j]! * filter[j]!;
    }
    melValues[i] = Math.max(sum, floor);
  }

  return melValues;
}

function createCQTBands(
  fftSize: number,
  sampleRate: number,
  fMin: number,
  binsPerOctave: number,
  numBins?: number
): CQTBand[] {
  const cacheKey = createCqtBandsKey(fftSize, sampleRate, fMin, binsPerOctave, numBins);
  const cached = cqtBandCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const nyquist = sampleRate / 2;
  const fftBinHz = sampleRate / fftSize;
  const maxBinIndex = Math.floor(fftSize / 2);

  if (!Number.isFinite(fMin) || fMin <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'fMin must be a positive number');
  }

  if (!Number.isFinite(binsPerOctave) || binsPerOctave <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'binsPerOctave must be a positive number');
  }

  if (numBins !== undefined && (!Number.isFinite(numBins) || numBins <= 0)) {
    throw new AudioInspectError('INVALID_INPUT', 'numBins must be a positive number');
  }

  const maxPossibleBins = Math.max(1, Math.floor(binsPerOctave * Math.log2(nyquist / fMin)));
  const targetBins = Math.min(numBins ?? maxPossibleBins, maxPossibleBins);
  const halfBin = 1 / (2 * binsPerOctave);
  const bands: CQTBand[] = [];

  for (let i = 0; i < targetBins; i++) {
    const center = fMin * Math.pow(2, i / binsPerOctave);
    if (center <= 0 || center >= nyquist) break;

    const lower = Math.max(0, center * Math.pow(2, -halfBin));
    const upper = Math.min(nyquist, center * Math.pow(2, halfBin));
    const startIndex = Math.max(1, Math.floor(lower / fftBinHz));
    const endIndex = Math.min(maxBinIndex, Math.ceil(upper / fftBinHz));

    if (endIndex < startIndex) {
      continue;
    }

    bands.push({
      centerFrequency: center,
      lowerFrequency: lower,
      upperFrequency: upper,
      startIndex,
      endIndex
    });
  }

  if (bands.length === 0) {
    throw new AudioInspectError(
      'INVALID_INPUT',
      'Failed to build CQT frequency bins. Review fMin/numBins settings.'
    );
  }

  cqtBandCache.set(cacheKey, bands);
  return bands;
}

function computeCQTBandValue(
  magnitude: Float32Array,
  band: CQTBand,
  sampleRate: number,
  fftSize: number,
  binsPerOctave: number,
  power: 1 | 2
): number {
  const halfBinInOctaves = 1 / (2 * binsPerOctave);
  let weightedSum = 0;
  let weightSum = 0;

  for (let i = band.startIndex; i <= band.endIndex; i++) {
    const freq = (i * sampleRate) / fftSize;
    if (freq <= 0) continue;

    const distance = Math.abs(Math.log2(freq / band.centerFrequency));
    if (distance > halfBinInOctaves) continue;

    const weight = 1 - distance / halfBinInOctaves;
    const mag = magnitude[i]!;
    const value = power === 2 ? mag * mag : mag;
    weightedSum += value * weight;
    weightSum += weight;
  }

  if (weightSum > 1e-10) {
    return weightedSum / weightSum;
  }

  const nearest = Math.min(
    Math.floor((band.centerFrequency * fftSize) / sampleRate),
    magnitude.length - 1
  );
  const nearestMag = nearest >= 0 ? magnitude[nearest]! : 0;
  return power === 2 ? nearestMag * nearestMag : nearestMag;
}

function dct(input: number[], numCoeffs: number): number[] {
  const N = input.length;
  const output = new Array<number>(numCoeffs);

  for (let k = 0; k < numCoeffs; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      const inputValue = input[n];
      if (inputValue !== undefined) {
        sum += inputValue * Math.cos((Math.PI * k * (n + 0.5)) / N);
      }
    }

    const norm = k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    output[k] = sum * norm;
  }

  return output;
}

function applyPreEmphasis(samples: Float32Array, coeff: number): Float32Array {
  const output = new Float32Array(samples.length);
  if (samples.length === 0) {
    return output;
  }
  output[0] = samples[0]!;

  for (let i = 1; i < samples.length; i++) {
    output[i] = samples[i]! - coeff * samples[i - 1]!;
  }

  return output;
}

export async function getMelSpectrogram(
  audio: AudioData,
  options: MelSpectrogramOptions = {}
): Promise<MelSpectrogramResult> {
  const {
    numMelFilters = 80,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    preEmphasis = 0.97,
    provider = 'native',
    enableProfiling = false,
    providerCache,
    power = 2,
    logScale = true,
    logEpsilon = 1e-10
  } = options;

  const samples = getChannelData(audio, options.channel ?? 'mix');
  const emphasizedSamples = applyPreEmphasis(samples, preEmphasis);
  const config = resolveFrameTransformConfig(audio, emphasizedSamples.length, options, 'hamming');
  const melFilterBank = createMelFilterBank(
    numMelFilters,
    config.fftSize,
    audio.sampleRate,
    minFrequency,
    maxFrequency
  );

  const melSpectrogram: number[][] = [];
  const times = new Float32Array(config.numFrames);
  const windowedFrame = new Float32Array(config.fftSize);
  const { provider: fftProvider, release } = await acquireFFTProvider({
    fftSize: config.fftSize,
    sampleRate: audio.sampleRate,
    provider,
    enableProfiling,
    fallbackToNative: provider === 'webfft',
    cache: providerCache
  });

  try {
    for (let frameIndex = 0; frameIndex < config.numFrames; frameIndex++) {
      const startSample = frameIndex * config.hopSizeSamples;
      times[frameIndex] = startSample / audio.sampleRate;

      fillWindowedFrameInto({
        src: emphasizedSamples,
        srcStart: startSample,
        frameLength: Math.min(
          config.frameSizeSamples,
          Math.max(0, emphasizedSamples.length - startSample)
        ),
        dst: windowedFrame,
        windowType: config.windowFunction
      });

      const fftResult = await fftProvider.fft(windowedFrame);
      const spectralValues = computeSpectrumPower(fftResult.magnitude, power);
      const melValues = applyMelFilterBank(spectralValues, melFilterBank.filters, logEpsilon);
      const frame = new Array<number>(melValues.length);

      for (let i = 0; i < melValues.length; i++) {
        const value = melValues[i]!;
        frame[i] = logScale ? Math.log(Math.max(value, logEpsilon)) : value;
      }

      melSpectrogram.push(frame);
    }
  } finally {
    release();
  }

  return {
    melSpectrogram,
    times,
    melFrequencies: melFilterBank.centerFrequencies,
    frameInfo: {
      frameSizeMs: config.frameSizeMs,
      hopSizeMs: config.hopSizeMs,
      numFrames: config.numFrames,
      numBins: melFilterBank.filters.length
    },
    frequencyRange: {
      min: minFrequency,
      max: maxFrequency
    }
  };
}

export async function getCQT(audio: AudioData, options: CQTOptions = {}): Promise<CQTResult> {
  const {
    fMin = 32.70319566257483, // C1
    binsPerOctave = 12,
    numBins,
    preEmphasis = 0.97,
    provider = 'native',
    enableProfiling = false,
    providerCache,
    power = 2,
    logScale = true,
    logEpsilon = 1e-10
  } = options;

  const samples = getChannelData(audio, options.channel ?? 'mix');
  const emphasizedSamples = applyPreEmphasis(samples, preEmphasis);
  const config = resolveFrameTransformConfig(audio, emphasizedSamples.length, options, 'hann');
  const bands = createCQTBands(config.fftSize, audio.sampleRate, fMin, binsPerOctave, numBins);
  const frequencies = new Float32Array(bands.length);
  for (let i = 0; i < bands.length; i++) {
    frequencies[i] = bands[i]!.centerFrequency;
  }

  const cqt: number[][] = [];
  const times = new Float32Array(config.numFrames);
  const windowedFrame = new Float32Array(config.fftSize);
  const { provider: fftProvider, release } = await acquireFFTProvider({
    fftSize: config.fftSize,
    sampleRate: audio.sampleRate,
    provider,
    enableProfiling,
    fallbackToNative: provider === 'webfft',
    cache: providerCache
  });

  try {
    for (let frameIndex = 0; frameIndex < config.numFrames; frameIndex++) {
      const startSample = frameIndex * config.hopSizeSamples;
      times[frameIndex] = startSample / audio.sampleRate;

      fillWindowedFrameInto({
        src: emphasizedSamples,
        srcStart: startSample,
        frameLength: Math.min(
          config.frameSizeSamples,
          Math.max(0, emphasizedSamples.length - startSample)
        ),
        dst: windowedFrame,
        windowType: config.windowFunction
      });

      const fftResult = await fftProvider.fft(windowedFrame);
      const frame = new Array<number>(bands.length);

      for (let i = 0; i < bands.length; i++) {
        const band = bands[i];
        if (!band) continue;

        const rawValue = computeCQTBandValue(
          fftResult.magnitude,
          band,
          audio.sampleRate,
          config.fftSize,
          binsPerOctave,
          power
        );
        frame[i] = logScale ? Math.log(Math.max(rawValue, logEpsilon)) : rawValue;
      }

      cqt.push(frame);
    }
  } finally {
    release();
  }

  return {
    cqt,
    times,
    frequencies,
    frameInfo: {
      frameSizeMs: config.frameSizeMs,
      hopSizeMs: config.hopSizeMs,
      numFrames: config.numFrames,
      numBins: frequencies.length,
      binsPerOctave
    },
    frequencyRange: {
      min: bands[0]?.lowerFrequency ?? fMin,
      max: bands[bands.length - 1]?.upperFrequency ?? audio.sampleRate / 2
    }
  };
}

function applyLiftering(mfcc: number[], lifterCoeff: number): number[] {
  return mfcc.map((coeff, index) => {
    if (lifterCoeff === 0) return coeff;
    const lifter = 1 + (lifterCoeff / 2) * Math.sin((Math.PI * index) / lifterCoeff);
    return coeff * lifter;
  });
}

export async function getMFCC(audio: AudioData, options: MFCCOptions = {}): Promise<MFCCResult> {
  const {
    numMelFilters = 40,
    numMfccCoeffs = 13,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    preEmphasis = 0.97,
    lifterCoeff = 22,
    provider = 'native',
    enableProfiling = false,
    providerCache
  } = options;

  const samples = getChannelData(audio, options.channel ?? 'mix');

  const emphasizedSamples = applyPreEmphasis(samples, preEmphasis);
  const config = resolveFrameTransformConfig(audio, emphasizedSamples.length, options, 'hamming');

  const melFilterBank = createMelFilterBank(
    numMelFilters,
    config.fftSize,
    audio.sampleRate,
    minFrequency,
    maxFrequency
  );

  const mfccData: number[][] = [];
  const times = new Float32Array(config.numFrames);
  const windowedFrame = new Float32Array(config.fftSize);
  const { provider: fftProvider, release } = await acquireFFTProvider({
    fftSize: config.fftSize,
    sampleRate: audio.sampleRate,
    provider,
    enableProfiling,
    fallbackToNative: provider === 'webfft',
    cache: providerCache
  });

  try {
    for (let frameIndex = 0; frameIndex < config.numFrames; frameIndex++) {
      const startSample = frameIndex * config.hopSizeSamples;
      times[frameIndex] = startSample / audio.sampleRate;

      fillWindowedFrameInto({
        src: emphasizedSamples,
        srcStart: startSample,
        frameLength: Math.min(
          config.frameSizeSamples,
          Math.max(0, emphasizedSamples.length - startSample)
        ),
        dst: windowedFrame,
        windowType: config.windowFunction
      });

      const fftResult = await fftProvider.fft(windowedFrame);
      const powerSpectrum = computeSpectrumPower(fftResult.magnitude, 2);

      const melSpectrum = applyMelFilterBank(powerSpectrum, melFilterBank.filters, 1e-10);

      const logMelSpectrum = new Array<number>(melSpectrum.length);
      for (let i = 0; i < melSpectrum.length; i++) {
        logMelSpectrum[i] = Math.log(Math.max(melSpectrum[i]!, 1e-10));
      }

      const mfccCoeffs = dct(logMelSpectrum, numMfccCoeffs);

      const lifteredMfcc = applyLiftering(mfccCoeffs, lifterCoeff);

      mfccData.push(lifteredMfcc);
    }
  } finally {
    release();
  }

  return {
    mfcc: mfccData,
    times,
    frameInfo: {
      frameSizeMs: config.frameSizeMs,
      hopSizeMs: config.hopSizeMs,
      numFrames: config.numFrames,
      numCoeffs: numMfccCoeffs
    },
    frequencyRange: {
      min: minFrequency,
      max: maxFrequency
    }
  };
}

export function computeDeltaCoefficients(
  coefficients: number[][],
  windowSize: number = 2
): { delta: number[][]; deltaDelta: number[][] } {
  const numFrames = coefficients.length;
  const numCoeffs = coefficients[0]?.length || 0;

  const delta: number[][] = [];
  const deltaDelta: number[][] = [];

  for (let i = 0; i < numFrames; i++) {
    const deltaFrame: number[] = [];

    for (let j = 0; j < numCoeffs; j++) {
      let numerator = 0;
      let denominator = 0;

      for (let k = -windowSize; k <= windowSize; k++) {
        const idx = Math.max(0, Math.min(numFrames - 1, i + k));
        const coeff = coefficients[idx]?.[j] || 0;
        numerator += k * coeff;
        denominator += k * k;
      }

      deltaFrame[j] = denominator > 0 ? numerator / denominator : 0;
    }

    delta.push(deltaFrame);
  }

  for (let i = 0; i < numFrames; i++) {
    const deltaDeltaFrame: number[] = [];

    for (let j = 0; j < numCoeffs; j++) {
      let numerator = 0;
      let denominator = 0;

      for (let k = -windowSize; k <= windowSize; k++) {
        const idx = Math.max(0, Math.min(numFrames - 1, i + k));
        const deltaCoeff = delta[idx]?.[j] || 0;
        numerator += k * deltaCoeff;
        denominator += k * k;
      }

      deltaDeltaFrame[j] = denominator > 0 ? numerator / denominator : 0;
    }

    deltaDelta.push(deltaDeltaFrame);
  }

  return { delta, deltaDelta };
}

export interface MFCCDeltaOptions extends MFCCOptions {
  deltaWindowSize?: number;

  computeDelta?: boolean;

  computeDeltaDelta?: boolean;
}

export interface MFCCDeltaResult extends MFCCResult {
  delta?: number[][];

  deltaDelta?: number[][];
}

export async function getMFCCWithDelta(
  audio: AudioData,
  options: MFCCDeltaOptions = {}
): Promise<MFCCDeltaResult> {
  const {
    deltaWindowSize = 2,
    computeDelta = true,
    computeDeltaDelta = true,
    ...mfccOptions
  } = options;

  const mfccResult = await getMFCC(audio, mfccOptions);

  const result: MFCCDeltaResult = { ...mfccResult };

  if (computeDelta || computeDeltaDelta) {
    const deltaCoeffs = computeDeltaCoefficients(mfccResult.mfcc, deltaWindowSize);

    if (computeDelta) {
      result.delta = deltaCoeffs.delta;
    }

    if (computeDeltaDelta) {
      result.deltaDelta = deltaCoeffs.deltaDelta;
    }
  }

  return result;
}
