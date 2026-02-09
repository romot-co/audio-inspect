import { AudioData, type ChannelSelector } from '../types.js';
import { getChannelData } from '../core/utils.js';
import { powToDb } from '../core/dsp/db.js';
import { forEachFrame } from '../core/dsp/frame-iterator.js';

// Voice activity detection options.
export interface VADOptions {
  channel?: ChannelSelector;
  frameSizeMs?: number;
  hopSizeMs?: number;
  method?: 'energy' | 'zcr' | 'combined' | 'adaptive';

  energyThreshold?: number;
  zcrThresholdLow?: number;
  zcrThresholdHigh?: number;

  adaptiveAlpha?: number;
  noiseFactor?: number;

  minSilenceDurationMs?: number;
  minSpeechDurationMs?: number;

  preEmphasis?: boolean;
  smoothing?: boolean;
}

export interface VADSegment {
  start: number;
  end: number;
  type: 'speech' | 'silence';
  confidence?: number;
}

export interface VADResult {
  segments: VADSegment[];
  speechRatio: number;
  features?: {
    energies: Float32Array;
    zcrs: Float32Array;
    decisions: Float32Array;
    times: Float32Array;
  };
}

// Standard pre-emphasis filter for speech processing.
function applyPreEmphasis(data: Float32Array, alpha: number = 0.97): Float32Array {
  const filtered = new Float32Array(data.length);
  if (data.length === 0) {
    return filtered;
  }
  filtered[0] = data[0]!;

  for (let i = 1; i < data.length; i++) {
    filtered[i] = data[i]! - alpha * data[i - 1]!;
  }

  return filtered;
}

// Compute per-frame energy and timestamps.
function calculateFrameEnergies(
  channelData: Float32Array,
  frameSizeSamples: number,
  hopSizeSamples: number,
  sampleRate: number,
  useLogEnergy: boolean = false
): { energies: Float32Array; times: Float32Array } {
  const energies: number[] = [];
  const times: number[] = [];

  if (channelData.length === 0) {
    return { energies: new Float32Array(0), times: new Float32Array(0) };
  }

  forEachFrame(
    {
      samples: channelData,
      frameSize: frameSizeSamples,
      hopSize: hopSizeSamples,
      sampleRate,
      padEnd: true
    },
    ({ frame, timeSec }) => {
      let energy = 0;
      for (let i = 0; i < frame.length; i++) {
        const sample = frame[i]!;
        energy += sample * sample;
      }
      energy /= frame.length;
      energies.push(useLogEnergy ? powToDb(energy, 1, -100) : energy);
      times.push(timeSec);
    }
  );

  return {
    energies: new Float32Array(energies),
    times: new Float32Array(times)
  };
}

// Compute zero-crossing rate per frame.
function calculateFrameZCRs(
  channelData: Float32Array,
  frameSizeSamples: number,
  hopSizeSamples: number,
  normalize: boolean = true
): Float32Array {
  const zcrs: number[] = [];

  if (channelData.length === 0) {
    return new Float32Array(0);
  }

  forEachFrame(
    {
      samples: channelData,
      frameSize: frameSizeSamples,
      hopSize: hopSizeSamples,
      sampleRate: 1,
      padEnd: true
    },
    ({ frame }) => {
      let crossings = 0;
      let prevSign = Math.sign(frame[0] ?? 0);
      for (let i = 1; i < frame.length; i++) {
        const sign = Math.sign(frame[i] ?? 0);
        if (prevSign !== sign && prevSign !== 0 && sign !== 0) {
          crossings += 1;
        }
        prevSign = sign;
      }
      zcrs.push(normalize ? crossings / Math.max(1, frame.length - 1) : crossings);
    }
  );

  return new Float32Array(zcrs);
}

// Track an adaptive threshold from low-energy frames.
function calculateAdaptiveThreshold(
  values: Float32Array,
  alpha: number,
  noiseFactor: number,
  initialFrames: number = 10
): Float32Array {
  const thresholds = new Float32Array(values.length);

  let noiseLevel = 0;
  const noiseFrames = Math.min(initialFrames, values.length);

  for (let i = 0; i < noiseFrames; i++) {
    noiseLevel += values[i]!;
  }
  noiseLevel = noiseFrames > 0 ? noiseLevel / noiseFrames : 0;

  for (let i = 0; i < values.length; i++) {
    const value = values[i]!;

    if (i === 0) {
      thresholds[i] = noiseLevel * noiseFactor;
    } else {
      const prevThreshold = thresholds[i - 1];
      if (prevThreshold !== undefined && value < prevThreshold) {
        noiseLevel = alpha * noiseLevel + (1 - alpha) * value;
      }
      thresholds[i] = noiseLevel * noiseFactor;
    }
  }

  return thresholds;
}

// Smooth binary-like decisions via median filtering.
function smoothDecisions(decisions: Float32Array, windowSize: number = 5): Float32Array {
  const smoothed = new Float32Array(decisions.length);
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < decisions.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(decisions.length, i + halfWindow + 1);

    const windowValues: number[] = [];
    for (let j = start; j < end; j++) {
      windowValues.push(decisions[j]!);
    }
    windowValues.sort((a, b) => a - b);

    if (windowValues.length > 0) {
      const medianIdx = Math.floor(windowValues.length / 2);
      smoothed[i] = windowValues[medianIdx]!;
    } else {
      smoothed[i] = 0;
    }
  }

  return smoothed;
}

// Convert frame decisions into speech/silence time segments.
function createSegmentsFromContinuous(
  decisions: Float32Array,
  times: Float32Array,
  threshold: number = 0.5,
  minSpeechSec: number = 0.1,
  minSilenceSec: number = 0.3
): VADSegment[] {
  const segments: VADSegment[] = [];
  let currentSegment: VADSegment | null = null;

  for (let i = 0; i < decisions.length; i++) {
    const decision = decisions[i]!;
    const time = times[i]!;

    const isSpeech = decision >= threshold;

    if (!currentSegment) {
      currentSegment = {
        start: time,
        end: time,
        type: isSpeech ? 'speech' : 'silence',
        confidence: Math.abs(decision - 0.5) * 2
      };
    } else if (
      (isSpeech && currentSegment.type === 'speech') ||
      (!isSpeech && currentSegment.type === 'silence')
    ) {
      currentSegment.end = time;
      const conf = Math.abs(decision - 0.5) * 2;
      currentSegment.confidence = Math.max(currentSegment.confidence || 0, conf);
    } else {
      segments.push(currentSegment);
      currentSegment = {
        start: time,
        end: time,
        type: isSpeech ? 'speech' : 'silence',
        confidence: Math.abs(decision - 0.5) * 2
      };
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  return filterShortSegments(segments, minSpeechSec, minSilenceSec);
}

// Remove short segments and merge compatible neighbors.
function filterShortSegments(
  segments: VADSegment[],
  minSpeechSec: number,
  minSilenceSec: number
): VADSegment[] {
  if (segments.length === 0) return [];

  const filtered: VADSegment[] = [];
  let i = 0;

  while (i < segments.length) {
    const current = segments[i];
    if (!current) {
      i++;
      continue;
    }

    const duration = current.end - current.start;

    if (
      (current.type === 'speech' && duration >= minSpeechSec) ||
      (current.type === 'silence' && duration >= minSilenceSec)
    ) {
      filtered.push(current);
      i++;
    } else {
      if (filtered.length > 0 && i + 1 < segments.length) {
        const prev = filtered[filtered.length - 1];
        const next = segments[i + 1];

        if (prev && next && prev.type === next.type) {
          prev.end = next.end;
          i += 2;
          continue;
        }
      }

      if (filtered.length > 0) {
        const lastFiltered = filtered[filtered.length - 1];
        if (lastFiltered) {
          lastFiltered.end = current.end;
        }
      }
      i++;
    }
  }

  return filtered;
}

// Perform VAD and return segments with optional intermediate features.
export function getVAD(audio: AudioData, options: VADOptions = {}): VADResult {
  const {
    channel = 'mix',
    frameSizeMs = 30,
    hopSizeMs = 10,
    method = 'combined',
    energyThreshold = 0.02,
    zcrThresholdLow = 0.05,
    zcrThresholdHigh = 0.15,
    adaptiveAlpha = 0.99,
    noiseFactor = 3.0,
    minSilenceDurationMs = 300,
    minSpeechDurationMs = 100,
    preEmphasis = true,
    smoothing = true
  } = options;

  let channelData = getChannelData(audio, channel);

  if (preEmphasis) {
    channelData = applyPreEmphasis(channelData);
  }

  const sr = audio.sampleRate;
  const frameSizeSamples = Math.floor((frameSizeMs / 1000) * sr);
  const hopSizeSamples = Math.floor((hopSizeMs / 1000) * sr);

  if (frameSizeSamples === 0 || hopSizeSamples === 0) {
    return { segments: [], speechRatio: 0 };
  }

  const { energies, times } = calculateFrameEnergies(
    channelData,
    frameSizeSamples,
    hopSizeSamples,
    sr,
    false
  );

  const zcrs = calculateFrameZCRs(channelData, frameSizeSamples, hopSizeSamples, true);

  if (energies.length === 0) {
    return { segments: [], speechRatio: 0 };
  }

  // Frame-level speech decision score (0..1).
  const decisions = new Float32Array(energies.length);

  switch (method) {
    case 'energy': {
      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i]!;
        decisions[i] = energy > energyThreshold ? 1 : 0;
      }
      break;
    }

    case 'zcr': {
      for (let i = 0; i < zcrs.length; i++) {
        const zcr = zcrs[i]!;
        decisions[i] = zcr > zcrThresholdLow && zcr < zcrThresholdHigh ? 1 : 0;
      }
      break;
    }

    case 'combined': {
      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i]!;
        const zcr = zcrs[i]!;

        const energyScore = energy > energyThreshold ? 1 : 0;
        const zcrScore = zcr > zcrThresholdLow && zcr < zcrThresholdHigh ? 1 : 0;
        decisions[i] = (energyScore + zcrScore) / 2;
      }
      break;
    }

    case 'adaptive': {
      // Adaptive mode updates threshold from estimated noise floor.
      const adaptiveThreshold = calculateAdaptiveThreshold(energies, adaptiveAlpha, noiseFactor);

      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i]!;
        const zcr = zcrs[i]!;
        const threshold = adaptiveThreshold[i]!;

        const energyScore = energy > threshold ? 1 : 0;
        const zcrScore = zcr > zcrThresholdLow && zcr < zcrThresholdHigh ? 0.5 : 0;
        decisions[i] = Math.min(1, energyScore + zcrScore);
      }
      break;
    }
  }

  // Optional median smoothing to reduce flicker.
  const finalDecisions = smoothing ? smoothDecisions(decisions, 5) : decisions;

  // Convert millisecond constraints into seconds for segment filtering.
  const minSpeechSec = minSpeechDurationMs / 1000;
  const minSilenceSec = minSilenceDurationMs / 1000;

  const segments = createSegmentsFromContinuous(
    finalDecisions,
    times,
    0.5,
    minSpeechSec,
    minSilenceSec
  );

  // Summarize total speech duration.
  let totalSpeechDuration = 0;
  for (const seg of segments) {
    if (seg.type === 'speech') {
      totalSpeechDuration += seg.end - seg.start;
    }
  }

  const speechRatio = audio.duration > 0 ? Math.min(1, totalSpeechDuration / audio.duration) : 0;

  return {
    segments,
    speechRatio,
    features: {
      energies,
      zcrs,
      decisions: finalDecisions,
      times
    }
  };
}
