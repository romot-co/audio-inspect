import {
  AudioData,
  AmplitudeOptions,
  AudioInspectError,
  type ChannelSelector,
  WaveformAnalysisResult,
  PeaksAnalysisResult,
  RMSAnalysisResult,
  ProgressOptions
} from '../types.js';
import { getChannelData, safeArrayAccess, getPerformanceNow } from '../core/utils.js';
import { ampToDb } from '../core/dsp/db.js';
import { getInterSamplePeak } from '../core/dsp/oversampling.js';

// Peak detector options.
export interface PeaksOptions {
  count?: number;
  threshold?: number;
  channel?: ChannelSelector;
  minDistance?: number;
}

export interface Peak {
  position: number;
  time: number;
  amplitude: number;
}

export interface PeaksResult {
  peaks: Peak[];
  maxAmplitude: number;
  averageAmplitude: number;
}

interface PeakCandidate {
  position: number;
  amplitude: number;
  prominence?: number;
}

// Detect all local maxima above threshold.
function detectAllInitialPeaks(
  data: Float32Array,
  threshold: number,
  includeProminence: boolean = false
): PeakCandidate[] {
  const peaks: PeakCandidate[] = [];
  const length = data.length;

  if (length < 3) return peaks;

  for (let i = 1; i < length - 1; i++) {
    const current = Math.abs(data[i]!);
    const prev = Math.abs(data[i - 1]!);
    const next = Math.abs(data[i + 1]!);

    if (current > prev && current > next && current > threshold) {
      const peak: PeakCandidate = {
        position: i,
        amplitude: current
      };

      // Optional prominence estimate can be used for post-ranking.
      if (includeProminence) {
        peak.prominence = calculateProminence(data, i, current);
      }

      peaks.push(peak);
    }
  }

  return peaks;
}

// Approximate prominence by searching valleys around the peak.
function calculateProminence(data: Float32Array, peakIndex: number, peakValue: number): number {
  let leftMin = peakValue;
  for (let i = peakIndex - 1; i >= 0; i--) {
    const value = Math.abs(data[i]!);
    if (value > peakValue) break;
    leftMin = Math.min(leftMin, value);
  }

  let rightMin = peakValue;
  for (let i = peakIndex + 1; i < data.length; i++) {
    const value = Math.abs(data[i]!);
    if (value > peakValue) break;
    rightMin = Math.min(rightMin, value);
  }

  return peakValue - Math.max(leftMin, rightMin);
}

// Peak detection with minimum-distance suppression.
export function getPeaks(audio: AudioData, options: PeaksOptions = {}): PeaksResult {
  const {
    count = 100,
    threshold = 0.1,
    channel = 'mix',
    minDistance = Math.floor(audio.sampleRate / 100)
  } = options;

  if (count <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'Peak count must be a positive integer');
  }

  if (threshold < 0 || threshold > 1) {
    throw new AudioInspectError('INVALID_INPUT', 'Threshold must be in the range [0, 1]');
  }

  const channelData = getChannelData(audio, channel);

  if (channelData.length === 0) {
    return {
      peaks: [],
      maxAmplitude: 0,
      averageAmplitude: 0
    };
  }

  const allInitialPeaks = detectAllInitialPeaks(channelData, threshold);

  if (allInitialPeaks.length === 0) {
    return {
      peaks: [],
      maxAmplitude: 0,
      averageAmplitude: 0
    };
  }

  // Rank peaks by amplitude before enforcing min distance.
  allInitialPeaks.sort((a, b) => b.amplitude - a.amplitude);

  const selectedPeaks: Peak[] = [];
  const occupiedRegions: Array<[number, number]> = [];

  for (const candidate of allInitialPeaks) {
    if (selectedPeaks.length >= count) break;

    const candidateStart = candidate.position - minDistance;
    const candidateEnd = candidate.position + minDistance;

    const hasOverlap = occupiedRegions.some(
      ([start, end]) => !(candidateEnd < start || candidateStart > end)
    );

    if (!hasOverlap) {
      selectedPeaks.push({
        position: candidate.position,
        time: candidate.position / audio.sampleRate,
        amplitude: candidate.amplitude
      });

      occupiedRegions.push([candidateStart, candidateEnd]);
    }
  }

  // Present selected peaks in timeline order.
  selectedPeaks.sort((a, b) => a.position - b.position);

  const maxAmplitude = allInitialPeaks.length > 0 ? (allInitialPeaks[0]?.amplitude ?? 0) : 0;
  const averageAmplitude =
    allInitialPeaks.length > 0
      ? allInitialPeaks.reduce((sum, p) => sum + p.amplitude, 0) / allInitialPeaks.length
      : 0;

  return {
    peaks: selectedPeaks,
    maxAmplitude,
    averageAmplitude
  };
}

const SILENCE_DB = -Infinity;

// RMS level for the requested channel selection.
export function getRMS(audio: AudioData, options: AmplitudeOptions = {}): number {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new AudioInspectError('INVALID_INPUT', 'RMS options must be an object');
  }

  const resolvedOptions = {
    channel: options.channel ?? 'mix',
    asDB: options.asDB ?? false,
    reference: options.reference ?? 1.0,
    truePeak: options.truePeak ?? false,
    oversamplingFactor: options.oversamplingFactor ?? 4,
    interpolation: options.interpolation ?? ('cubic' as const)
  };

  const channelData = getChannelData(audio, resolvedOptions.channel);

  if (channelData.length === 0) {
    return resolvedOptions.asDB ? SILENCE_DB : 0;
  }

  // Ignore non-finite samples.
  let sumOfSquares = 0;
  let validSampleCount = 0;
  for (let i = 0; i < channelData.length; i++) {
    const sample = channelData[i]!;
    if (Number.isFinite(sample)) {
      sumOfSquares += sample * sample;
      validSampleCount++;
    }
  }

  if (validSampleCount === 0) {
    return resolvedOptions.asDB ? SILENCE_DB : 0;
  }

  const rms = Math.sqrt(sumOfSquares / validSampleCount);

  return resolvedOptions.asDB ? ampToDb(rms, resolvedOptions.reference) : rms;
}

// Peak or true-peak amplitude for the requested channel selection.
export function getPeakAmplitude(audio: AudioData, options: AmplitudeOptions = {}): number {
  const resolvedOptions = {
    channel: options.channel ?? 'mix',
    asDB: options.asDB ?? false,
    reference: options.reference ?? 1.0,
    truePeak: options.truePeak ?? false,
    oversamplingFactor: options.oversamplingFactor ?? 4,
    interpolation: options.interpolation ?? ('cubic' as const)
  };

  const channelData = getChannelData(audio, resolvedOptions.channel);

  if (channelData.length === 0) {
    return resolvedOptions.asDB ? SILENCE_DB : 0;
  }

  let peak: number;

  if (resolvedOptions.truePeak) {
    // Inter-sample peak via interpolation-based oversampling.
    peak = getInterSamplePeak(channelData, {
      factor: resolvedOptions.oversamplingFactor,
      interpolation: resolvedOptions.interpolation
    });
  } else {
    // Sample peak from original discrete waveform.
    peak = 0;
    for (let i = 0; i < channelData.length; i++) {
      peak = Math.max(peak, Math.abs(channelData[i]!));
    }
  }

  return resolvedOptions.asDB ? ampToDb(peak, resolvedOptions.reference) : peak;
}

export { getPeakAmplitude as getPeak };

// Zero-crossing rate in normalized crossings per sample.
export function getZeroCrossing(audio: AudioData, channel: ChannelSelector = 'mix'): number {
  const channelData = getChannelData(audio, channel);

  if (channelData.length < 2) {
    return 0;
  }

  let crossings = 0;
  for (let i = 1; i < channelData.length; i++) {
    const prev = channelData[i - 1]!;
    const current = channelData[i]!;

    if ((prev >= 0 && current < 0) || (prev < 0 && current >= 0)) {
      crossings++;
    }
  }

  return crossings / (channelData.length - 1);
}

export interface WaveformOptions {
  framesPerSecond?: number;
  channel?: ChannelSelector;
  method?: 'rms' | 'peak' | 'average';
}

export interface WaveformPoint {
  time: number;
  amplitude: number;
}

export interface WaveformResult {
  waveform: WaveformPoint[];
  maxAmplitude: number;
  averageAmplitude: number;
  frameCount: number;
  samplesPerFrame: number;
}

// Downsample waveform into fixed-rate frame amplitudes.
export function getWaveform(audio: AudioData, options: WaveformOptions = {}): WaveformResult {
  const { framesPerSecond = 60, channel = 'mix', method = 'rms' } = options;

  const channelData = getChannelData(audio, channel);

  // Keep frame count bounded by available sample count.
  const desiredFrameCount = Math.ceil(audio.duration * framesPerSecond);
  const maxPossibleFrameCount = audio.length > 0 ? audio.length : desiredFrameCount > 0 ? 1 : 0;
  const frameCount = Math.min(desiredFrameCount, maxPossibleFrameCount);

  const samplesPerFrame = frameCount > 0 ? Math.max(1, Math.floor(audio.length / frameCount)) : 0;

  const waveform: WaveformPoint[] = [];
  let maxAmplitude = 0;
  let totalAmplitude = 0;

  for (let i = 0; i < frameCount; i++) {
    const startSample = i * samplesPerFrame;
    const endSample = Math.min(startSample + samplesPerFrame, channelData.length);

    if (endSample <= startSample) {
      // Reuse the last amplitude if the frame is out of range.
      const lastAmplitude =
        waveform.length > 0
          ? safeArrayAccess(waveform, waveform.length - 1, { time: 0, amplitude: 0 }).amplitude
          : 0;

      waveform.push({
        time: (startSample + samplesPerFrame / 2) / audio.sampleRate,
        amplitude: lastAmplitude
      });
      continue;
    }

    const frameData = channelData.subarray(startSample, endSample);

    let amplitude: number;
    switch (method) {
      case 'peak':
        amplitude = calculatePeakAmplitude(frameData);
        break;
      case 'average':
        amplitude = calculateAverageAmplitude(frameData);
        break;
      case 'rms':
      default:
        amplitude = calculateRMSAmplitude(frameData);
        break;
    }

    const time = (startSample + (endSample - startSample) / 2) / audio.sampleRate;
    waveform.push({ time, amplitude });

    maxAmplitude = Math.max(maxAmplitude, amplitude);
    totalAmplitude += amplitude;
  }

  const averageAmplitude = frameCount > 0 ? totalAmplitude / frameCount : 0;

  return {
    waveform,
    maxAmplitude,
    averageAmplitude,
    frameCount,
    samplesPerFrame
  };
}

function calculateRMSAmplitude(frameData: Float32Array): number {
  if (frameData.length === 0) return 0;

  let sum = 0;
  for (let i = 0; i < frameData.length; i++) {
    const sample = frameData[i]!;
    sum += sample * sample;
  }
  return Math.sqrt(sum / frameData.length);
}

function calculatePeakAmplitude(frameData: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < frameData.length; i++) {
    const sample = Math.abs(frameData[i]!);
    peak = Math.max(peak, sample);
  }
  return peak;
}

function calculateAverageAmplitude(frameData: Float32Array): number {
  if (frameData.length === 0) return 0;

  let sum = 0;
  for (let i = 0; i < frameData.length; i++) {
    sum += Math.abs(frameData[i]!);
  }
  return sum / frameData.length;
}

export interface WaveformAnalysisOptions extends ProgressOptions {
  framesPerSecond?: number;
  channel?: ChannelSelector;
  method?: 'rms' | 'peak' | 'average';
}

export interface PeaksAnalysisOptions extends ProgressOptions {
  count?: number;
  threshold?: number;
  channel?: ChannelSelector;
  minDistance?: number;
}

export interface RMSAnalysisOptions extends ProgressOptions {
  channel?: ChannelSelector;
  asDB?: boolean;
  reference?: number;
}

// Rich waveform analysis with progress callbacks and metadata.
export function getWaveformAnalysis(
  audio: AudioData,
  options: WaveformAnalysisOptions = {}
): WaveformAnalysisResult {
  const startTime = getPerformanceNow();
  const { framesPerSecond = 60, channel = 'mix', method = 'rms', onProgress } = options;

  onProgress?.(0, 'Starting waveform analysis');

  const channelData = getChannelData(audio, channel);

  const desiredFrameCount = Math.ceil(audio.duration * framesPerSecond);
  const maxPossibleFrameCount = audio.length > 0 ? audio.length : desiredFrameCount > 0 ? 1 : 0;
  const frameCount = Math.min(desiredFrameCount, maxPossibleFrameCount);
  const samplesPerFrame = frameCount > 0 ? Math.max(1, Math.floor(audio.length / frameCount)) : 0;

  onProgress?.(25, 'Frame configuration complete');

  const amplitudes = new Float32Array(frameCount);
  const timestamps = new Float32Array(frameCount);

  let maxAmplitude = 0;
  let totalAmplitude = 0;

  onProgress?.(50, 'Starting amplitude calculation');

  for (let i = 0; i < frameCount; i++) {
    const startSample = i * samplesPerFrame;
    const endSample = Math.min(startSample + samplesPerFrame, channelData.length);

    if (endSample <= startSample) {
      const lastAmplitude = i > 0 ? amplitudes[i - 1]! : 0;
      amplitudes[i] = lastAmplitude;
      timestamps[i] = (startSample + samplesPerFrame / 2) / audio.sampleRate;
      continue;
    }

    const frameData = channelData.subarray(startSample, endSample);

    let amplitude: number;
    switch (method) {
      case 'peak':
        amplitude = calculatePeakAmplitude(frameData);
        break;
      case 'average':
        amplitude = calculateAverageAmplitude(frameData);
        break;
      case 'rms':
      default:
        amplitude = calculateRMSAmplitude(frameData);
        break;
    }

    amplitudes[i] = amplitude;
    timestamps[i] = (startSample + (endSample - startSample) / 2) / audio.sampleRate;

    maxAmplitude = Math.max(maxAmplitude, amplitude);
    totalAmplitude += amplitude;

    if (i % Math.max(1, Math.floor(frameCount / 20)) === 0) {
      const progress = 50 + (i / frameCount) * 45;
      onProgress?.(Math.round(progress), `Processing frame ${i + 1}/${frameCount}`);
    }
  }

  const averageAmplitude = frameCount > 0 ? totalAmplitude / frameCount : 0;
  const processingTime = getPerformanceNow() - startTime;

  onProgress?.(100, 'Processing complete');

  return {
    amplitudes,
    timestamps,
    frameCount,
    samplesPerFrame,
    framesPerSecond,
    maxAmplitude,
    averageAmplitude,
    sampleRate: audio.sampleRate,
    duration: audio.duration,
    processingTime
  };
}

// Rich peak analysis with progress callbacks and metadata.
export function getPeaksAnalysis(
  audio: AudioData,
  options: PeaksAnalysisOptions = {}
): PeaksAnalysisResult {
  const startTime = getPerformanceNow();
  const {
    count = 100,
    threshold = 0.1,
    channel = 'mix',
    minDistance = Math.floor(audio.sampleRate / 100),
    onProgress
  } = options;

  onProgress?.(0, 'Starting peaks analysis');

  if (count <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'Peak count must be a positive integer');
  }

  if (threshold < 0 || threshold > 1) {
    throw new AudioInspectError('INVALID_INPUT', 'Threshold must be in the range [0, 1]');
  }

  const channelData = getChannelData(audio, channel);

  if (channelData.length === 0) {
    return {
      positions: new Float32Array(0),
      amplitudes: new Float32Array(0),
      times: new Float32Array(0),
      maxAmplitude: 0,
      averageAmplitude: 0,
      count: 0,
      sampleRate: audio.sampleRate,
      duration: audio.duration,
      processingTime: getPerformanceNow() - startTime
    };
  }

  onProgress?.(25, 'Detecting peak candidates');

  const allInitialPeaks = detectAllInitialPeaks(channelData, threshold);

  if (allInitialPeaks.length === 0) {
    return {
      positions: new Float32Array(0),
      amplitudes: new Float32Array(0),
      times: new Float32Array(0),
      maxAmplitude: 0,
      averageAmplitude: 0,
      count: 0,
      sampleRate: audio.sampleRate,
      duration: audio.duration,
      processingTime: getPerformanceNow() - startTime
    };
  }

  onProgress?.(50, 'Sorting peaks');

  allInitialPeaks.sort((a, b) => b.amplitude - a.amplitude);

  onProgress?.(75, 'Selecting peaks');

  const selectedPeaks: Peak[] = [];
  const occupiedRegions: Array<[number, number]> = [];

  for (const candidate of allInitialPeaks) {
    if (selectedPeaks.length >= count) break;

    const candidateStart = candidate.position - minDistance;
    const candidateEnd = candidate.position + minDistance;

    const hasOverlap = occupiedRegions.some(
      ([start, end]) => !(candidateEnd < start || candidateStart > end)
    );

    if (!hasOverlap) {
      selectedPeaks.push({
        position: candidate.position,
        time: candidate.position / audio.sampleRate,
        amplitude: candidate.amplitude
      });

      occupiedRegions.push([candidateStart, candidateEnd]);
    }
  }

  selectedPeaks.sort((a, b) => a.position - b.position);

  const positions = new Float32Array(selectedPeaks.length);
  const amplitudes = new Float32Array(selectedPeaks.length);
  const times = new Float32Array(selectedPeaks.length);

  for (let i = 0; i < selectedPeaks.length; i++) {
    const peak = selectedPeaks[i];
    if (peak) {
      positions[i] = peak.position;
      amplitudes[i] = peak.amplitude;
      times[i] = peak.time;
    }
  }

  const maxAmplitude = allInitialPeaks.length > 0 ? (allInitialPeaks[0]?.amplitude ?? 0) : 0;
  const averageAmplitude =
    allInitialPeaks.length > 0
      ? allInitialPeaks.reduce((sum, p) => sum + p.amplitude, 0) / allInitialPeaks.length
      : 0;

  const processingTime = getPerformanceNow() - startTime;

  onProgress?.(100, 'Processing complete');

  return {
    positions,
    amplitudes,
    times,
    maxAmplitude,
    averageAmplitude,
    count: selectedPeaks.length,
    sampleRate: audio.sampleRate,
    duration: audio.duration,
    processingTime
  };
}

// Rich RMS analysis with progress callbacks and metadata.
export function getRMSAnalysis(
  audio: AudioData,
  options: RMSAnalysisOptions = {}
): RMSAnalysisResult {
  const startTime = getPerformanceNow();
  const { channel = 'mix', asDB = false, reference = 1.0, onProgress } = options;
  const reportChannel = typeof channel === 'number' ? channel : -1;

  onProgress?.(0, 'Starting RMS analysis');

  const channelData = getChannelData(audio, channel);

  if (channelData.length === 0) {
    const value = asDB ? -Infinity : 0;
    return {
      value,
      channel: reportChannel,
      sampleRate: audio.sampleRate,
      duration: audio.duration,
      processingTime: getPerformanceNow() - startTime
    };
  }

  onProgress?.(50, 'Computing RMS value');

  let sumSquares = 0;
  let validSampleCount = 0;
  for (let i = 0; i < channelData.length; i++) {
    const sample = channelData[i]!;
    if (Number.isFinite(sample)) {
      sumSquares += sample * sample;
      validSampleCount++;
    }
  }

  if (validSampleCount === 0) {
    const value = asDB ? -Infinity : 0;
    const processingTime = getPerformanceNow() - startTime;

    onProgress?.(100, 'Processing complete');

    if (asDB) {
      return {
        value,
        channel: reportChannel,
        sampleRate: audio.sampleRate,
        duration: audio.duration,
        processingTime
      };
    }

    return {
      value,
      valueDB: -Infinity,
      channel: reportChannel,
      sampleRate: audio.sampleRate,
      duration: audio.duration,
      processingTime
    };
  }

  const rmsValue = Math.sqrt(sumSquares / validSampleCount);
  const processingTime = getPerformanceNow() - startTime;

  onProgress?.(100, 'Processing complete');

  if (asDB) {
    return {
      value: ampToDb(rmsValue, reference),
      channel: reportChannel,
      sampleRate: audio.sampleRate,
      duration: audio.duration,
      processingTime
    };
  } else {
    return {
      value: rmsValue,
      valueDB: ampToDb(rmsValue, reference),
      channel: reportChannel,
      sampleRate: audio.sampleRate,
      duration: audio.duration,
      processingTime
    };
  }
}
