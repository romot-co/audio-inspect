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

// src/features/dynamics.ts
var dynamics_exports = {};
__export(dynamics_exports, {
  getCrestFactor: () => getCrestFactor
});
module.exports = __toCommonJS(dynamics_exports);

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
          throw new AudioInspectError(
            "INVALID_INPUT",
            `\u30C1\u30E3\u30F3\u30CD\u30EB ${ch} \u306E\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`
          );
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
      `\u7121\u52B9\u306A\u30C1\u30E3\u30F3\u30CD\u30EB\u756A\u53F7: ${channel}\u3002\u6709\u52B9\u7BC4\u56F2\u306F 0-${audio.numberOfChannels - 1} \u307E\u305F\u306F -1\uFF08\u5E73\u5747\uFF09\u3067\u3059`
    );
  }
  const channelData = audio.channelData[channel];
  if (!channelData) {
    throw new AudioInspectError(
      "INVALID_INPUT",
      `\u30C1\u30E3\u30F3\u30CD\u30EB ${channel} \u306E\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`
    );
  }
  return channelData;
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

// src/features/dynamics.ts
function calculateFrameCrestFactor(frameData, method = "simple") {
  if (frameData.length === 0) {
    return { peak: 0, rms: 0, cfDb: -Infinity, cfLinear: 0 };
  }
  let processedData = frameData;
  if (method === "weighted") {
    processedData = frameData;
  }
  let peakVal = 0;
  let sumOfSquares = 0;
  let validSamples = 0;
  for (let i = 0; i < processedData.length; i++) {
    const sample = ensureValidSample(processedData[i]);
    const absSample = Math.abs(sample);
    peakVal = Math.max(peakVal, absSample);
    sumOfSquares += sample * sample;
    validSamples++;
  }
  if (validSamples === 0) {
    return { peak: 0, rms: 0, cfDb: -Infinity, cfLinear: 0 };
  }
  const rmsVal = Math.sqrt(sumOfSquares / validSamples);
  if (rmsVal < 1e-10) {
    return { peak: peakVal, rms: rmsVal, cfDb: Infinity, cfLinear: Infinity };
  }
  const cfLinear = peakVal / rmsVal;
  const cfDb = 20 * Math.log10(cfLinear);
  return { peak: peakVal, rms: rmsVal, cfDb, cfLinear };
}
function getCrestFactor(audio, options = {}) {
  const {
    channel = 0,
    windowSize,
    hopSize,
    method = "simple"
  } = options;
  const amplitudeOpts = { channel, asDB: false };
  const overallPeak = getPeakAmplitude(audio, amplitudeOpts);
  const overallRms = getRMS(audio, amplitudeOpts);
  const overallCfLinear = overallRms > 1e-10 ? overallPeak / overallRms : Infinity;
  const overallCfDb = overallRms > 1e-10 ? 20 * Math.log10(overallCfLinear) : Infinity;
  let timeVaryingResult;
  if (typeof windowSize === "number" && typeof hopSize === "number") {
    if (windowSize <= 0 || hopSize <= 0) {
      throw new AudioInspectError(
        "INVALID_INPUT",
        "windowSize\u3068hopSize\u306F\u6B63\u306E\u5024\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059"
      );
    }
    if (hopSize > windowSize) {
      console.warn("[audio-inspect] hopSize\u304CwindowSize\u3088\u308A\u5927\u304D\u3044\u305F\u3081\u3001\u5206\u6790\u7A93\u9593\u306B\u30AE\u30E3\u30C3\u30D7\u304C\u751F\u3058\u307E\u3059");
    }
    const windowSizeSamples = Math.floor(windowSize * audio.sampleRate);
    const hopSizeSamples = Math.floor(hopSize * audio.sampleRate);
    if (windowSizeSamples === 0 || hopSizeSamples === 0) {
      throw new AudioInspectError(
        "INVALID_INPUT",
        "\u30B5\u30F3\u30D7\u30EB\u30EC\u30FC\u30C8\u306B\u5BFE\u3057\u3066\u7A93\u30B5\u30A4\u30BA\u304C\u5C0F\u3055\u3059\u304E\u307E\u3059"
      );
    }
    const channelData = getChannelData(audio, channel);
    const dataLength = channelData.length;
    if (dataLength < windowSizeSamples) {
      const result = calculateFrameCrestFactor(channelData, method);
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
        const frameResult = calculateFrameCrestFactor(frameData, method);
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
//# sourceMappingURL=dynamics.cjs.map