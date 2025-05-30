// src/types.ts
var AudioInspectError = class extends Error {
  constructor(code, message, cause) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
  name = "AudioInspectError";
};

// src/core/utils.ts
function getChannelData(audio, channel) {
  if (channel === -1) {
    const averageData = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        const channelData2 = audio.channelData[ch];
        if (!channelData2) {
          throw new AudioInspectError("INVALID_INPUT", `Channel ${ch} data does not exist`);
        }
        if (i < channelData2.length) {
          const sample = channelData2[i];
          if (sample !== void 0) {
            sum += sample;
          }
        }
      }
      averageData[i] = sum / audio.numberOfChannels;
    }
    return averageData;
  }
  if (channel < 0 || channel >= audio.numberOfChannels) {
    throw new AudioInspectError(
      "INVALID_INPUT",
      `Invalid channel number: ${channel}. Valid range is 0-${audio.numberOfChannels - 1} or -1 (average)`
    );
  }
  const channelData = audio.channelData[channel];
  if (!channelData) {
    throw new AudioInspectError("INVALID_INPUT", `Channel ${channel} data does not exist`);
  }
  return channelData;
}
function isValidSample(value) {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
}
function ensureValidSample(value, defaultValue = 0) {
  return isValidSample(value) ? value : defaultValue;
}

// src/features/vad.ts
function applyPreEmphasis(data, alpha = 0.97) {
  const filtered = new Float32Array(data.length);
  filtered[0] = data[0] || 0;
  for (let i = 1; i < data.length; i++) {
    const current = ensureValidSample(data[i]);
    const previous = ensureValidSample(data[i - 1]);
    filtered[i] = current - alpha * previous;
  }
  return filtered;
}
function calculateFrameEnergies(channelData, frameSizeSamples, hopSizeSamples, sampleRate, useLogEnergy = false) {
  const dataLength = channelData.length;
  if (dataLength < frameSizeSamples) {
    return { energies: new Float32Array(0), times: new Float32Array(0) };
  }
  const frameCount = Math.floor((dataLength - frameSizeSamples) / hopSizeSamples) + 1;
  const energies = new Float32Array(frameCount);
  const times = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    const start = i * hopSizeSamples;
    const end = Math.min(start + frameSizeSamples, dataLength);
    let energy = 0;
    let validSamples = 0;
    for (let j = start; j < end; j++) {
      const sample = ensureValidSample(channelData[j]);
      energy += sample * sample;
      validSamples++;
    }
    energy = validSamples > 0 ? energy / validSamples : 0;
    if (useLogEnergy) {
      energies[i] = energy > 1e-10 ? 10 * Math.log10(energy) : -100;
    } else {
      energies[i] = energy;
    }
    times[i] = (start + frameSizeSamples / 2) / sampleRate;
  }
  return { energies, times };
}
function calculateFrameZCRs(channelData, frameSizeSamples, hopSizeSamples, normalize = true) {
  const dataLength = channelData.length;
  if (dataLength < frameSizeSamples) {
    return new Float32Array(0);
  }
  const frameCount = Math.floor((dataLength - frameSizeSamples) / hopSizeSamples) + 1;
  const zcrs = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    const start = i * hopSizeSamples;
    const end = Math.min(start + frameSizeSamples, dataLength);
    let crossings = 0;
    let prevSign = Math.sign(ensureValidSample(channelData[start]));
    for (let j = start + 1; j < end; j++) {
      const sample = ensureValidSample(channelData[j]);
      const currentSign = Math.sign(sample);
      if (prevSign !== currentSign && prevSign !== 0 && currentSign !== 0) {
        crossings++;
      }
      prevSign = currentSign;
    }
    zcrs[i] = normalize ? crossings / Math.max(1, end - start - 1) : crossings;
  }
  return zcrs;
}
function calculateAdaptiveThreshold(values, alpha, noiseFactor, initialFrames = 10) {
  const thresholds = new Float32Array(values.length);
  let noiseLevel = 0;
  const noiseFrames = Math.min(initialFrames, values.length);
  for (let i = 0; i < noiseFrames; i++) {
    const value = values[i];
    if (value !== void 0) {
      noiseLevel += value;
    }
  }
  noiseLevel = noiseFrames > 0 ? noiseLevel / noiseFrames : 0;
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === void 0) {
      thresholds[i] = i > 0 ? thresholds[i - 1] ?? noiseLevel * noiseFactor : noiseLevel * noiseFactor;
      continue;
    }
    if (i === 0) {
      thresholds[i] = noiseLevel * noiseFactor;
    } else {
      const prevThreshold = thresholds[i - 1];
      if (prevThreshold !== void 0 && value < prevThreshold) {
        noiseLevel = alpha * noiseLevel + (1 - alpha) * value;
      }
      thresholds[i] = noiseLevel * noiseFactor;
    }
  }
  return thresholds;
}
function smoothDecisions(decisions, windowSize = 5) {
  const smoothed = new Float32Array(decisions.length);
  const halfWindow = Math.floor(windowSize / 2);
  for (let i = 0; i < decisions.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(decisions.length, i + halfWindow + 1);
    const windowValues = [];
    for (let j = start; j < end; j++) {
      const value = decisions[j];
      if (value !== void 0) {
        windowValues.push(value);
      }
    }
    windowValues.sort((a, b) => a - b);
    if (windowValues.length > 0) {
      const medianIdx = Math.floor(windowValues.length / 2);
      const medianValue = windowValues[medianIdx];
      smoothed[i] = medianValue ?? 0;
    } else {
      smoothed[i] = 0;
    }
  }
  return smoothed;
}
function createSegmentsFromContinuous(decisions, times, threshold = 0.5, minSpeechSec = 0.1, minSilenceSec = 0.3) {
  const segments = [];
  let currentSegment = null;
  for (let i = 0; i < decisions.length; i++) {
    const decision = decisions[i];
    const time = times[i];
    if (decision === void 0 || time === void 0) continue;
    const isSpeech = decision >= threshold;
    if (!currentSegment) {
      currentSegment = {
        start: time,
        end: time,
        type: isSpeech ? "speech" : "silence",
        confidence: Math.abs(decision - 0.5) * 2
      };
    } else if (isSpeech && currentSegment.type === "speech" || !isSpeech && currentSegment.type === "silence") {
      currentSegment.end = time;
      const conf = Math.abs(decision - 0.5) * 2;
      currentSegment.confidence = Math.max(currentSegment.confidence || 0, conf);
    } else {
      segments.push(currentSegment);
      currentSegment = {
        start: time,
        end: time,
        type: isSpeech ? "speech" : "silence",
        confidence: Math.abs(decision - 0.5) * 2
      };
    }
  }
  if (currentSegment) {
    segments.push(currentSegment);
  }
  return filterShortSegments(segments, minSpeechSec, minSilenceSec);
}
function filterShortSegments(segments, minSpeechSec, minSilenceSec) {
  if (segments.length === 0) return [];
  const filtered = [];
  let i = 0;
  while (i < segments.length) {
    const current = segments[i];
    if (!current) {
      i++;
      continue;
    }
    const duration = current.end - current.start;
    if (current.type === "speech" && duration >= minSpeechSec || current.type === "silence" && duration >= minSilenceSec) {
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
function getVAD(audio, options = {}) {
  const {
    channel = 0,
    frameSizeMs = 30,
    // 30msフレーム
    hopSizeMs = 10,
    // 10msホップ
    method = "combined",
    energyThreshold = 0.02,
    zcrThresholdLow = 0.05,
    zcrThresholdHigh = 0.15,
    adaptiveAlpha = 0.99,
    noiseFactor = 3,
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
  const frameSizeSamples = Math.floor(frameSizeMs / 1e3 * sr);
  const hopSizeSamples = Math.floor(hopSizeMs / 1e3 * sr);
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
  const decisions = new Float32Array(energies.length);
  switch (method) {
    case "energy": {
      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        decisions[i] = energy !== void 0 && energy > energyThreshold ? 1 : 0;
      }
      break;
    }
    case "zcr": {
      for (let i = 0; i < zcrs.length; i++) {
        const zcr = zcrs[i];
        decisions[i] = zcr !== void 0 && zcr > zcrThresholdLow && zcr < zcrThresholdHigh ? 1 : 0;
      }
      break;
    }
    case "combined": {
      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        const zcr = zcrs[i];
        const energyScore = energy !== void 0 && energy > energyThreshold ? 1 : 0;
        const zcrScore = zcr !== void 0 && zcr > zcrThresholdLow && zcr < zcrThresholdHigh ? 1 : 0;
        decisions[i] = (energyScore + zcrScore) / 2;
      }
      break;
    }
    case "adaptive": {
      const adaptiveThreshold = calculateAdaptiveThreshold(energies, adaptiveAlpha, noiseFactor);
      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i];
        const zcr = zcrs[i];
        const threshold = adaptiveThreshold[i];
        const energyScore = energy !== void 0 && threshold !== void 0 && energy > threshold ? 1 : 0;
        const zcrScore = zcr !== void 0 && zcr > zcrThresholdLow && zcr < zcrThresholdHigh ? 0.5 : 0;
        decisions[i] = Math.min(1, energyScore + zcrScore);
      }
      break;
    }
  }
  const finalDecisions = smoothing ? smoothDecisions(decisions, 5) : decisions;
  const minSpeechSec = minSpeechDurationMs / 1e3;
  const minSilenceSec = minSilenceDurationMs / 1e3;
  const segments = createSegmentsFromContinuous(
    finalDecisions,
    times,
    0.5,
    minSpeechSec,
    minSilenceSec
  );
  let totalSpeechDuration = 0;
  for (const seg of segments) {
    if (seg.type === "speech") {
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
export {
  getVAD
};
//# sourceMappingURL=vad.js.map