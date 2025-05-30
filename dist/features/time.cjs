"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/features/time.ts
var time_exports = {};
__export(time_exports, {
  getPeak: () => getPeakAmplitude,
  getPeakAmplitude: () => getPeakAmplitude,
  getPeaks: () => getPeaks,
  getRMS: () => getRMS,
  getWaveform: () => getWaveform,
  getZeroCrossing: () => getZeroCrossing
});
module.exports = __toCommonJS(time_exports);

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
function safeArrayAccess(array, index, defaultValue) {
  if (index >= 0 && index < array.length) {
    return array[index] ?? defaultValue;
  }
  return defaultValue;
}
function isValidSample(value) {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
}
function ensureValidSample(value, defaultValue = 0) {
  return isValidSample(value) ? value : defaultValue;
}
function amplitudeToDecibels(amplitude, reference = 1) {
  const MIN_AMPLITUDE_FOR_DB = 1e-10;
  const SILENCE_DB2 = -Infinity;
  if (amplitude <= 0 || reference <= 0) {
    return SILENCE_DB2;
  }
  const ratio = amplitude / reference;
  return ratio > MIN_AMPLITUDE_FOR_DB ? 20 * Math.log10(ratio) : SILENCE_DB2;
}

// src/features/time.ts
function detectAllInitialPeaks(data, threshold, includeProminence = false) {
  const peaks = [];
  const length = data.length;
  if (length < 3) return peaks;
  for (let i = 1; i < length - 1; i++) {
    const current = Math.abs(ensureValidSample(data[i]));
    const prev = Math.abs(ensureValidSample(data[i - 1]));
    const next = Math.abs(ensureValidSample(data[i + 1]));
    if (current > prev && current > next && current > threshold) {
      const peak = {
        position: i,
        amplitude: current
      };
      if (includeProminence) {
        peak.prominence = calculateProminence(data, i, current);
      }
      peaks.push(peak);
    }
  }
  return peaks;
}
function calculateProminence(data, peakIndex, peakValue) {
  let leftMin = peakValue;
  for (let i = peakIndex - 1; i >= 0; i--) {
    const value = Math.abs(ensureValidSample(data[i]));
    if (value > peakValue) break;
    leftMin = Math.min(leftMin, value);
  }
  let rightMin = peakValue;
  for (let i = peakIndex + 1; i < data.length; i++) {
    const value = Math.abs(ensureValidSample(data[i]));
    if (value > peakValue) break;
    rightMin = Math.min(rightMin, value);
  }
  return peakValue - Math.max(leftMin, rightMin);
}
function getPeaks(audio, options = {}) {
  const {
    count = 100,
    threshold = 0.1,
    channel = 0,
    minDistance = Math.floor(audio.sampleRate / 100)
    // デフォルト10ms
  } = options;
  if (count <= 0) {
    throw new AudioInspectError("INVALID_INPUT", "\u30D4\u30FC\u30AF\u6570\u306F\u6B63\u306E\u6574\u6570\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059");
  }
  if (threshold < 0 || threshold > 1) {
    throw new AudioInspectError("INVALID_INPUT", "\u95BE\u5024\u306F0\u304B\u30891\u306E\u7BC4\u56F2\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059");
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
  allInitialPeaks.sort((a, b) => b.amplitude - a.amplitude);
  const selectedPeaks = [];
  const occupiedRegions = [];
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
  const maxAmplitude = allInitialPeaks.length > 0 ? allInitialPeaks[0]?.amplitude ?? 0 : 0;
  const averageAmplitude = allInitialPeaks.length > 0 ? allInitialPeaks.reduce((sum, p) => sum + p.amplitude, 0) / allInitialPeaks.length : 0;
  return {
    peaks: selectedPeaks,
    maxAmplitude,
    averageAmplitude
  };
}
var SILENCE_DB = -Infinity;
function getRMS(audio, optionsOrChannel = {}) {
  const options = typeof optionsOrChannel === "number" ? { channel: optionsOrChannel, asDB: false, reference: 1 } : {
    channel: 0,
    asDB: false,
    reference: 1,
    ...optionsOrChannel
  };
  const channelData = getChannelData(audio, options.channel);
  if (channelData.length === 0) {
    return options.asDB ? SILENCE_DB : 0;
  }
  let sumOfSquares = 0;
  let validSampleCount = 0;
  for (let i = 0; i < channelData.length; i++) {
    const sample = channelData[i];
    if (isValidSample(sample)) {
      sumOfSquares += sample * sample;
      validSampleCount++;
    }
  }
  if (validSampleCount === 0) {
    return options.asDB ? SILENCE_DB : 0;
  }
  const rms = Math.sqrt(sumOfSquares / validSampleCount);
  return options.asDB ? amplitudeToDecibels(rms, options.reference) : rms;
}
function getPeakAmplitude(audio, options = {}) {
  const resolvedOptions = {
    channel: 0,
    asDB: false,
    reference: 1,
    ...options
  };
  const channelData = getChannelData(audio, resolvedOptions.channel);
  if (channelData.length === 0) {
    return resolvedOptions.asDB ? SILENCE_DB : 0;
  }
  let peak = 0;
  for (let i = 0; i < channelData.length; i++) {
    const sample = channelData[i];
    if (isValidSample(sample)) {
      peak = Math.max(peak, Math.abs(sample));
    }
  }
  return resolvedOptions.asDB ? amplitudeToDecibels(peak, resolvedOptions.reference) : peak;
}
function getZeroCrossing(audio, channel = 0) {
  const channelData = getChannelData(audio, channel);
  if (channelData.length < 2) {
    return 0;
  }
  let crossings = 0;
  for (let i = 1; i < channelData.length; i++) {
    const prev = ensureValidSample(channelData[i - 1]);
    const current = ensureValidSample(channelData[i]);
    if (prev >= 0 && current < 0 || prev < 0 && current >= 0) {
      crossings++;
    }
  }
  return crossings / (channelData.length - 1);
}
function getWaveform(audio, options = {}) {
  const { framesPerSecond = 60, channel = 0, method = "rms" } = options;
  const channelData = getChannelData(audio, channel);
  const desiredFrameCount = Math.ceil(audio.duration * framesPerSecond);
  const maxPossibleFrameCount = audio.length > 0 ? audio.length : desiredFrameCount > 0 ? 1 : 0;
  const frameCount = Math.min(desiredFrameCount, maxPossibleFrameCount);
  const samplesPerFrame = frameCount > 0 ? Math.max(1, Math.floor(audio.length / frameCount)) : 0;
  const waveform = [];
  let maxAmplitude = 0;
  let totalAmplitude = 0;
  for (let i = 0; i < frameCount; i++) {
    const startSample = i * samplesPerFrame;
    const endSample = Math.min(startSample + samplesPerFrame, channelData.length);
    if (endSample <= startSample) {
      const lastAmplitude = waveform.length > 0 ? safeArrayAccess(waveform, waveform.length - 1, { time: 0, amplitude: 0 }).amplitude : 0;
      waveform.push({
        time: (startSample + samplesPerFrame / 2) / audio.sampleRate,
        amplitude: lastAmplitude
      });
      continue;
    }
    const frameData = channelData.subarray(startSample, endSample);
    let amplitude;
    switch (method) {
      case "peak":
        amplitude = calculatePeakAmplitude(frameData);
        break;
      case "average":
        amplitude = calculateAverageAmplitude(frameData);
        break;
      case "rms":
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
function calculateRMSAmplitude(frameData) {
  if (frameData.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < frameData.length; i++) {
    const sample = ensureValidSample(frameData[i]);
    sum += sample * sample;
  }
  return Math.sqrt(sum / frameData.length);
}
function calculatePeakAmplitude(frameData) {
  let peak = 0;
  for (let i = 0; i < frameData.length; i++) {
    const sample = Math.abs(ensureValidSample(frameData[i]));
    peak = Math.max(peak, sample);
  }
  return peak;
}
function calculateAverageAmplitude(frameData) {
  if (frameData.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < frameData.length; i++) {
    sum += Math.abs(ensureValidSample(frameData[i]));
  }
  return sum / frameData.length;
}
//# sourceMappingURL=time.cjs.map