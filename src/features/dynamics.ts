import { AudioData, AudioInspectError, AmplitudeOptions, type ChannelSelector } from '../types.js';
import { getChannelData } from '../core/utils.js';
import { applyAWeighting } from '../core/dsp/a-weighting.js';
import { ampToDb } from '../core/dsp/db.js';
import { getRMS, getPeakAmplitude } from './time.js';

// Crest factor options for whole-signal and optional frame-based analysis.
export interface CrestFactorOptions {
  channel?: ChannelSelector;
  windowSize?: number;
  hopSize?: number;
  method?: 'simple' | 'weighted';
}

// Crest factor outputs in dB and linear domain.
export interface CrestFactorResult {
  crestFactor: number;
  crestFactorLinear: number;
  peak: number;
  rms: number;
  timeVarying?:
    | {
        times: Float32Array;
        values: Float32Array; // dB
        valuesLinear: Float32Array;
        peaks: Float32Array;
        rmsValues: Float32Array;
      }
    | undefined;
}

// Compute crest factor for one frame, with optional A-weighting.
function calculateFrameCrestFactor(
  frameData: Float32Array,
  sampleRate: number,
  method: 'simple' | 'weighted' = 'simple'
): { peak: number; rms: number; cfDb: number; cfLinear: number } {
  const epsilon = 1e-10;

  if (frameData.length === 0) {
    return { peak: 0, rms: 0, cfDb: -Infinity, cfLinear: 0 };
  }

  let processedData = frameData;

  // Weighted mode applies an A-weighting filter before peak/RMS extraction.
  if (method === 'weighted') {
    processedData = applyAWeighting(frameData, sampleRate);
  }

  let peakVal = 0;
  let sumOfSquares = 0;

  for (let i = 0; i < processedData.length; i++) {
    const sample = processedData[i]!;
    const absSample = Math.abs(sample);

    peakVal = Math.max(peakVal, absSample);
    sumOfSquares += sample * sample;
  }

  if (processedData.length === 0) {
    return { peak: 0, rms: 0, cfDb: -Infinity, cfLinear: 0 };
  }

  const rmsVal = Math.sqrt(sumOfSquares / processedData.length);

  if (peakVal < epsilon && rmsVal < epsilon) {
    return { peak: 0, rms: 0, cfDb: -Infinity, cfLinear: 0 };
  }

  if (rmsVal < epsilon) {
    return { peak: peakVal, rms: rmsVal, cfDb: -Infinity, cfLinear: 0 };
  }

  const cfLinear = peakVal / rmsVal;
  const cfDb = ampToDb(cfLinear, 1);

  return { peak: peakVal, rms: rmsVal, cfDb, cfLinear };
}

export function getCrestFactor(
  audio: AudioData,
  options: CrestFactorOptions = {}
): CrestFactorResult {
  const epsilon = 1e-10;
  const { channel = 'mix', windowSize, hopSize, method = 'simple' } = options;

  let overallPeak: number;
  let overallRms: number;

  if (method === 'weighted') {
    // In weighted mode, compute both peak and RMS on weighted samples.
    const channelData = getChannelData(audio, channel);
    const weightedData = applyAWeighting(channelData, audio.sampleRate);

    let peakVal = 0;
    let sumOfSquares = 0;

    for (let i = 0; i < weightedData.length; i++) {
      const sample = weightedData[i]!;
      const absSample = Math.abs(sample);

      peakVal = Math.max(peakVal, absSample);

      sumOfSquares += sample * sample;
    }

    overallPeak = peakVal;
    overallRms = weightedData.length > 0 ? Math.sqrt(sumOfSquares / weightedData.length) : 0;
  } else {
    // Simple mode reuses existing amplitude primitives.
    const amplitudeOpts: AmplitudeOptions = { channel, asDB: false };
    overallPeak = getPeakAmplitude(audio, amplitudeOpts);
    overallRms = getRMS(audio, amplitudeOpts);
  }

  let overallCfLinear: number;
  let overallCfDb: number;
  if (overallPeak < epsilon && overallRms < epsilon) {
    overallCfLinear = 0;
    overallCfDb = -Infinity;
  } else if (overallRms < epsilon) {
    overallCfLinear = 0;
    overallCfDb = -Infinity;
  } else {
    overallCfLinear = overallPeak / overallRms;
    overallCfDb = ampToDb(overallCfLinear, 1);
  }

  let timeVaryingResult: CrestFactorResult['timeVarying'] | undefined;

  // Optional frame-based crest factor time series.
  if (typeof windowSize === 'number' && typeof hopSize === 'number') {
    if (windowSize <= 0 || hopSize <= 0) {
      throw new AudioInspectError(
        'INVALID_INPUT',
        'windowSize and hopSize must be positive values'
      );
    }

    if (hopSize > windowSize) {
      console.warn(
        '[audio-inspect] hopSize is larger than windowSize, so gaps will occur between analysis windows'
      );
    }

    const windowSizeSamples = Math.floor(windowSize * audio.sampleRate);
    const hopSizeSamples = Math.floor(hopSize * audio.sampleRate);

    if (windowSizeSamples === 0 || hopSizeSamples === 0) {
      throw new AudioInspectError('INVALID_INPUT', 'Window size is too small for the sample rate');
    }

    const channelData = getChannelData(audio, channel);
    const dataLength = channelData.length;

    if (dataLength < windowSizeSamples) {
      // For short input, emit one frame centered on the full clip.
      const result = calculateFrameCrestFactor(channelData, audio.sampleRate, method);
      timeVaryingResult = {
        times: new Float32Array([audio.duration / 2]),
        values: new Float32Array([result.cfDb]),
        valuesLinear: new Float32Array([result.cfLinear]),
        peaks: new Float32Array([result.peak]),
        rmsValues: new Float32Array([result.rms])
      };
    } else {
      const frameCount = Math.floor((dataLength - windowSizeSamples) / hopSizeSamples) + 1;
      const times = new Float32Array(frameCount);
      const values = new Float32Array(frameCount);
      const valuesLinear = new Float32Array(frameCount);
      const peaks = new Float32Array(frameCount);
      const rmsValues = new Float32Array(frameCount);

      for (let i = 0; i < frameCount; i++) {
        const start = i * hopSizeSamples;
        const end = Math.min(start + windowSizeSamples, dataLength);
        const frameData = channelData.subarray(start, end);

        const frameResult = calculateFrameCrestFactor(frameData, audio.sampleRate, method);

        times[i] = (start + windowSizeSamples / 2) / audio.sampleRate;
        values[i] = frameResult.cfDb;
        valuesLinear[i] = frameResult.cfLinear;
        peaks[i] = frameResult.peak;
        rmsValues[i] = frameResult.rms;
      }

      timeVaryingResult = { times, values, valuesLinear, peaks, rmsValues };
    }
  }

  return {
    crestFactor: overallCfDb,
    crestFactorLinear: overallCfLinear,
    peak: overallPeak,
    rms: overallRms,
    timeVarying: timeVaryingResult
  };
}
