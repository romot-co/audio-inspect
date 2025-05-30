"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/features/index.ts
var features_exports = {};
__export(features_exports, {
  getCrestFactor: () => getCrestFactor,
  getEnergy: () => getEnergy,
  getFFT: () => getFFT,
  getLUFS: () => getLUFS,
  getPeak: () => getPeakAmplitude,
  getPeakAmplitude: () => getPeakAmplitude,
  getPeaks: () => getPeaks,
  getRMS: () => getRMS,
  getSpectralFeatures: () => getSpectralFeatures,
  getSpectrum: () => getSpectrum,
  getStereoAnalysis: () => getStereoAnalysis,
  getTimeVaryingSpectralFeatures: () => getTimeVaryingSpectralFeatures,
  getTimeVaryingStereoAnalysis: () => getTimeVaryingStereoAnalysis,
  getVAD: () => getVAD,
  getWaveform: () => getWaveform,
  getZeroCrossing: () => getZeroCrossing
});
module.exports = __toCommonJS(features_exports);

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

// src/core/fft-provider.ts
var WebFFTProvider = class {
  constructor(size, sampleRate, enableProfiling = false) {
    this.size = size;
    this.sampleRate = sampleRate;
    this.enableProfiling = enableProfiling;
  }
  fftInstance = null;
  get name() {
    return "WebFFT";
  }
  async initializeWebFFT() {
    try {
      const webfftModule = await import("webfft");
      const WebFFTConstructor = webfftModule.default;
      this.fftInstance = new WebFFTConstructor(this.size);
      if (this.enableProfiling && this.fftInstance?.profile) {
        await this.fftInstance.profile();
      }
    } catch (error) {
      throw new AudioInspectError(
        "UNSUPPORTED_FORMAT",
        `WebFFT\u306E\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  fft(input) {
    if (!this.fftInstance) {
      throw new AudioInspectError("UNSUPPORTED_FORMAT", "WebFFT\u304C\u521D\u671F\u5316\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
    }
    if (input.length !== this.size) {
      throw new AudioInspectError(
        "INVALID_INPUT",
        `\u5165\u529B\u30B5\u30A4\u30BA\u304C\u4E0D\u6B63\u3067\u3059\u3002\u671F\u5F85\u5024: ${this.size}, \u5B9F\u969B: ${input.length}`
      );
    }
    const complexInput = new Float32Array(this.size * 2);
    for (let i = 0; i < this.size; i++) {
      complexInput[i * 2] = input[i] || 0;
      complexInput[i * 2 + 1] = 0;
    }
    const complexOutput = this.fftInstance.fft(complexInput);
    const magnitude = new Float32Array(this.size / 2 + 1);
    const phase = new Float32Array(this.size / 2 + 1);
    const frequencies = new Float32Array(this.size / 2 + 1);
    for (let i = 0; i < magnitude.length; i++) {
      const real = complexOutput[i * 2] || 0;
      const imag = complexOutput[i * 2 + 1] || 0;
      magnitude[i] = Math.sqrt(real * real + imag * imag);
      phase[i] = Math.atan2(imag, real);
      frequencies[i] = i * this.sampleRate / this.size;
    }
    return {
      complex: complexOutput,
      magnitude,
      phase,
      frequencies
    };
  }
  async profile() {
    if (!this.fftInstance || !this.fftInstance.profile) {
      throw new AudioInspectError("UNSUPPORTED_FORMAT", "WebFFT\u304C\u521D\u671F\u5316\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
    }
    await this.fftInstance.profile();
  }
  dispose() {
    if (this.fftInstance && this.fftInstance.dispose) {
      this.fftInstance.dispose();
      this.fftInstance = null;
    }
  }
};
var NativeFFTProvider = class {
  constructor(size, sampleRate) {
    this.size = size;
    this.sampleRate = sampleRate;
    if (!this.isPowerOfTwo(size)) {
      throw new AudioInspectError("INVALID_INPUT", "FFT\u30B5\u30A4\u30BA\u306F2\u306E\u51AA\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059");
    }
    this.precomputeTables();
  }
  bitReversalTable;
  twiddleFactorsReal;
  twiddleFactorsImag;
  get name() {
    return "Native FFT (Cooley-Tukey)";
  }
  isPowerOfTwo(n) {
    return n > 0 && (n & n - 1) === 0;
  }
  precomputeTables() {
    this.bitReversalTable = new Uint32Array(this.size);
    const bits = Math.log2(this.size);
    for (let i = 0; i < this.size; i++) {
      let reversed = 0;
      for (let j = 0; j < bits; j++) {
        reversed = reversed << 1 | i >> j & 1;
      }
      this.bitReversalTable[i] = reversed;
    }
    const halfSize = this.size / 2;
    this.twiddleFactorsReal = new Float32Array(halfSize);
    this.twiddleFactorsImag = new Float32Array(halfSize);
    for (let i = 0; i < halfSize; i++) {
      const angle = -2 * Math.PI * i / this.size;
      this.twiddleFactorsReal[i] = Math.cos(angle);
      this.twiddleFactorsImag[i] = Math.sin(angle);
    }
  }
  fft(input) {
    if (input.length !== this.size) {
      throw new AudioInspectError(
        "INVALID_INPUT",
        `\u5165\u529B\u30B5\u30A4\u30BA\u304C\u4E0D\u6B63\u3067\u3059\u3002\u671F\u5F85\u5024: ${this.size}, \u5B9F\u969B: ${input.length}`
      );
    }
    const real = new Float32Array(this.size);
    const imag = new Float32Array(this.size);
    for (let i = 0; i < this.size; i++) {
      const reversedIndex = this.bitReversalTable[i];
      if (reversedIndex !== void 0) {
        real[reversedIndex] = input[i] || 0;
        imag[reversedIndex] = 0;
      }
    }
    for (let stage = 1; stage < this.size; stage *= 2) {
      const stageSize = stage * 2;
      const twiddleStep = this.size / stageSize;
      for (let k = 0; k < this.size; k += stageSize) {
        for (let j = 0; j < stage; j++) {
          const twiddleIndex = j * twiddleStep;
          const wr = this.twiddleFactorsReal[twiddleIndex] || 0;
          const wi = this.twiddleFactorsImag[twiddleIndex] || 0;
          const evenIndex = k + j;
          const oddIndex = k + j + stage;
          const evenReal = real[evenIndex] || 0;
          const evenImag = imag[evenIndex] || 0;
          const oddReal = real[oddIndex] || 0;
          const oddImag = imag[oddIndex] || 0;
          const tempReal = oddReal * wr - oddImag * wi;
          const tempImag = oddReal * wi + oddImag * wr;
          real[evenIndex] = evenReal + tempReal;
          imag[evenIndex] = evenImag + tempImag;
          real[oddIndex] = evenReal - tempReal;
          imag[oddIndex] = evenImag - tempImag;
        }
      }
    }
    const complex = new Float32Array(this.size * 2);
    const magnitude = new Float32Array(this.size / 2 + 1);
    const phase = new Float32Array(this.size / 2 + 1);
    const frequencies = new Float32Array(this.size / 2 + 1);
    for (let i = 0; i < this.size; i++) {
      complex[i * 2] = real[i] || 0;
      complex[i * 2 + 1] = imag[i] || 0;
      if (i <= this.size / 2) {
        const realPart = real[i] || 0;
        const imagPart = imag[i] || 0;
        magnitude[i] = Math.sqrt(realPart * realPart + imagPart * imagPart);
        phase[i] = Math.atan2(imagPart, realPart);
        frequencies[i] = i * this.sampleRate / this.size;
      }
    }
    return { complex, magnitude, phase, frequencies };
  }
  dispose() {
  }
};
var FFTProviderFactory = class {
  /**
   * 指定された設定でFFTプロバイダーを作成
   */
  static async createProvider(config) {
    switch (config.type) {
      case "webfft": {
        const provider = new WebFFTProvider(
          config.fftSize,
          config.sampleRate,
          config.enableProfiling
        );
        await provider.initializeWebFFT();
        return provider;
      }
      case "native":
        return new NativeFFTProvider(config.fftSize, config.sampleRate);
      case "custom":
        if (!config.customProvider) {
          throw new AudioInspectError("INVALID_INPUT", "\u30AB\u30B9\u30BF\u30E0\u30D7\u30ED\u30D0\u30A4\u30C0\u30FC\u304C\u6307\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
        }
        return config.customProvider;
      default: {
        const exhaustiveCheck = config.type;
        throw new AudioInspectError(
          "UNSUPPORTED_FORMAT",
          `\u672A\u5BFE\u5FDC\u306EFFT\u30D7\u30ED\u30D0\u30A4\u30C0\u30FC: ${String(exhaustiveCheck)}`
        );
      }
    }
  }
  /**
   * 利用可能なプロバイダーをリスト
   */
  static getAvailableProviders() {
    return ["webfft", "native"];
  }
};

// src/features/frequency.ts
function applyWindow(data, windowType) {
  const windowed = new Float32Array(data.length);
  const N = data.length;
  for (let i = 0; i < N; i++) {
    let windowValue = 1;
    switch (windowType) {
      case "hann":
        windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
        break;
      case "hamming":
        windowValue = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
        break;
      case "blackman":
        windowValue = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (N - 1));
        break;
      case "none":
      default:
        windowValue = 1;
        break;
    }
    windowed[i] = (data[i] || 0) * windowValue;
  }
  return windowed;
}
function getChannelData2(audio, channel) {
  if (channel === -1) {
    const averageData = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        const channelData2 = audio.channelData[ch];
        if (channelData2 && i < channelData2.length) {
          sum += channelData2[i];
        }
      }
      averageData[i] = sum / audio.numberOfChannels;
    }
    return averageData;
  }
  if (channel < -1 || channel >= audio.numberOfChannels) {
    throw new AudioInspectError("INVALID_INPUT", `Invalid channel number: ${channel}`);
  }
  const channelData = audio.channelData[channel];
  if (!channelData) {
    throw new AudioInspectError("INVALID_INPUT", `Channel ${channel} data does not exist`);
  }
  return channelData;
}
async function getFFT(audio, options = {}) {
  const {
    fftSize = 2048,
    windowFunction = "hann",
    channel = 0,
    provider = "webfft",
    enableProfiling = false
  } = options;
  const channelData = getChannelData2(audio, channel);
  let inputData;
  if (channelData.length < fftSize) {
    inputData = new Float32Array(fftSize);
    inputData.set(channelData);
  } else {
    inputData = channelData.slice(0, fftSize);
  }
  const windowedData = applyWindow(inputData, windowFunction);
  const fftProvider = await FFTProviderFactory.createProvider({
    type: provider,
    fftSize,
    sampleRate: audio.sampleRate,
    enableProfiling
  });
  try {
    const result = fftProvider.fft(windowedData);
    return {
      ...result,
      fftSize,
      windowFunction,
      providerName: fftProvider.name
    };
  } finally {
    fftProvider.dispose();
  }
}
async function getSpectrum(audio, options = {}) {
  const {
    fftSize = 2048,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    decibels = true,
    timeFrames = 1,
    overlap = 0.5,
    ...fftOptions
  } = options;
  const channelData = getChannelData2(audio, options.channel || 0);
  if (timeFrames === 1) {
    const fftResult = await getFFT(audio, { ...fftOptions, fftSize });
    const filteredResult = filterFrequencyRange(fftResult, minFrequency, maxFrequency);
    const result = {
      frequencies: filteredResult.frequencies,
      magnitudes: filteredResult.magnitude
    };
    if (decibels) {
      result.decibels = magnitudeToDecibels(filteredResult.magnitude);
    }
    return result;
  } else {
    const spectrogram = await computeSpectrogram(
      channelData,
      audio.sampleRate,
      fftSize,
      timeFrames,
      overlap,
      { ...fftOptions, minFrequency, maxFrequency, decibels }
    );
    return {
      frequencies: spectrogram.frequencies,
      magnitudes: new Float32Array(),
      // スペクトログラムでは個別のmagnitudesは空
      spectrogram
    };
  }
}
function filterFrequencyRange(fftResult, minFreq, maxFreq) {
  const { frequencies, magnitude, phase, complex } = fftResult;
  const startIndex = frequencies.findIndex((f) => f >= minFreq);
  const endIndex = frequencies.findIndex((f) => f > maxFreq);
  const actualEndIndex = endIndex === -1 ? frequencies.length : endIndex;
  return {
    frequencies: frequencies.slice(startIndex, actualEndIndex),
    magnitude: magnitude.slice(startIndex, actualEndIndex),
    phase: phase.slice(startIndex, actualEndIndex),
    complex: complex.slice(startIndex * 2, actualEndIndex * 2)
  };
}
function magnitudeToDecibels(magnitude) {
  const decibels = new Float32Array(magnitude.length);
  for (let i = 0; i < magnitude.length; i++) {
    const mag = magnitude[i] || 0;
    decibels[i] = mag > 0 ? 20 * Math.log10(mag) : -Infinity;
  }
  return decibels;
}
async function computeSpectrogram(data, sampleRate, fftSize, timeFrames, overlap, options) {
  const hopSize = Math.floor(fftSize * (1 - overlap));
  let numPossibleFrames;
  if (data.length === 0) {
    numPossibleFrames = 0;
  } else if (data.length < fftSize) {
    numPossibleFrames = 1;
  } else {
    numPossibleFrames = Math.floor((data.length - fftSize) / hopSize) + 1;
  }
  const actualFrames = Math.min(timeFrames, numPossibleFrames);
  const times = new Float32Array(actualFrames);
  const intensities = [];
  let frequencies = new Float32Array();
  let filteredFrequencies = new Float32Array();
  let frequencyStartIndex = 0;
  let frequencyEndIndex = 0;
  const fftProvider = await FFTProviderFactory.createProvider({
    type: options.provider || "webfft",
    fftSize,
    sampleRate,
    enableProfiling: options.enableProfiling || false
  });
  try {
    for (let frame = 0; frame < actualFrames; frame++) {
      const startSample = frame * hopSize;
      const frameData = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        frameData[i] = startSample + i < data.length ? data[startSample + i] || 0 : 0;
      }
      const windowedData = applyWindow(frameData, options.windowFunction || "hann");
      const fftResult = fftProvider.fft(windowedData);
      if (frame === 0) {
        frequencies = fftResult.frequencies;
        const minFreq = options.minFrequency || 0;
        const maxFreq = options.maxFrequency || sampleRate / 2;
        frequencyStartIndex = frequencies.findIndex((f) => f >= minFreq);
        if (frequencyStartIndex === -1) frequencyStartIndex = 0;
        const tempEndIndex = frequencies.findIndex((f) => f > maxFreq);
        frequencyEndIndex = tempEndIndex === -1 ? frequencies.length : tempEndIndex;
        filteredFrequencies = frequencies.slice(frequencyStartIndex, frequencyEndIndex);
      }
      const magnitude = fftResult.magnitude;
      const filteredMagnitude = magnitude.slice(frequencyStartIndex, frequencyEndIndex);
      const frameIntensity = options.decibels ? magnitudeToDecibels(filteredMagnitude) : filteredMagnitude;
      intensities.push(frameIntensity);
      times[frame] = (startSample + fftSize / 2) / sampleRate;
    }
  } finally {
    fftProvider.dispose();
  }
  return {
    times,
    frequencies: filteredFrequencies,
    // フィルタリングされた周波数軸を返す
    intensities,
    timeFrames: actualFrames,
    frequencyBins: filteredFrequencies.length
  };
}

// src/features/spectral.ts
function calculateSpectralCentroid(magnitude, frequencies, minFreq, maxFreq) {
  let weightedSum = 0;
  let magnitudeSum = 0;
  for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
    const freq = frequencies[i];
    const mag = magnitude[i];
    if (freq !== void 0 && mag !== void 0 && freq >= minFreq && freq <= maxFreq) {
      weightedSum += freq * mag;
      magnitudeSum += mag;
    }
  }
  return magnitudeSum > 1e-10 ? weightedSum / magnitudeSum : 0;
}
function calculateSpectralBandwidth(magnitude, frequencies, centroid, minFreq, maxFreq) {
  let weightedVarianceSum = 0;
  let magnitudeSum = 0;
  for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
    const freq = frequencies[i];
    const mag = magnitude[i];
    if (freq !== void 0 && mag !== void 0 && freq >= minFreq && freq <= maxFreq) {
      const deviation = freq - centroid;
      weightedVarianceSum += deviation * deviation * mag;
      magnitudeSum += mag;
    }
  }
  return magnitudeSum > 1e-10 ? Math.sqrt(weightedVarianceSum / magnitudeSum) : 0;
}
function calculateSpectralRolloff(magnitude, frequencies, threshold, minFreq, maxFreq) {
  let totalEnergy = 0;
  for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
    const freq = frequencies[i];
    const mag = magnitude[i];
    if (freq !== void 0 && mag !== void 0 && freq >= minFreq && freq <= maxFreq) {
      totalEnergy += mag * mag;
    }
  }
  const targetEnergy = totalEnergy * threshold;
  let cumulativeEnergy = 0;
  for (let i = 0; i < magnitude.length && i < frequencies.length; i++) {
    const freq = frequencies[i];
    const mag = magnitude[i];
    if (freq !== void 0 && mag !== void 0 && freq >= minFreq && freq <= maxFreq) {
      cumulativeEnergy += mag * mag;
      if (cumulativeEnergy >= targetEnergy) {
        return freq;
      }
    }
  }
  return maxFreq;
}
function calculateSpectralFlatness(magnitude, minIndex, maxIndex) {
  let geometricMean = 0;
  let arithmeticMean = 0;
  let count = 0;
  for (let i = minIndex; i <= maxIndex && i < magnitude.length; i++) {
    const mag = magnitude[i];
    if (mag !== void 0) {
      const safeMag = Math.max(mag, 1e-10);
      geometricMean += Math.log(safeMag);
      arithmeticMean += safeMag;
      count++;
    }
  }
  if (count === 0) return 0;
  geometricMean = Math.exp(geometricMean / count);
  arithmeticMean = arithmeticMean / count;
  return arithmeticMean > 1e-10 ? geometricMean / arithmeticMean : 0;
}
function calculateZeroCrossingRate(samples) {
  if (samples.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = ensureValidSample(samples[i - 1]);
    const curr = ensureValidSample(samples[i]);
    if (prev >= 0 && curr < 0 || prev < 0 && curr >= 0) {
      crossings++;
    }
  }
  return crossings / (samples.length - 1);
}
function calculateSpectralFlux(currentMagnitude, previousMagnitude) {
  if (!previousMagnitude) return 0;
  let flux = 0;
  const length = Math.min(currentMagnitude.length, previousMagnitude.length);
  for (let i = 0; i < length; i++) {
    const current = currentMagnitude[i];
    const previous = previousMagnitude[i];
    if (current !== void 0 && previous !== void 0) {
      const diff = current - previous;
      flux += diff * diff;
    }
  }
  return Math.sqrt(flux / length);
}
async function getSpectralFeatures(audio, options = {}) {
  const {
    fftSize = 2048,
    windowFunction = "hann",
    channel = 0,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    rolloffThreshold = 0.85
  } = options;
  if (channel >= audio.numberOfChannels) {
    throw new AudioInspectError("INVALID_INPUT", `\u7121\u52B9\u306A\u30C1\u30E3\u30F3\u30CD\u30EB\u756A\u53F7: ${channel}`);
  }
  const fftResult = await getFFT(audio, {
    fftSize,
    windowFunction,
    channel
  });
  const minIndex = Math.max(0, Math.floor(minFrequency * fftSize / audio.sampleRate));
  const maxIndex = Math.min(
    fftResult.frequencies.length - 1,
    Math.floor(maxFrequency * fftSize / audio.sampleRate)
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
  const samples = audio.channelData[channel];
  if (!samples) {
    throw new AudioInspectError("INVALID_INPUT", `\u30C1\u30E3\u30F3\u30CD\u30EB ${channel} \u306E\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`);
  }
  const zeroCrossingRate = calculateZeroCrossingRate(samples);
  return {
    spectralCentroid,
    spectralBandwidth,
    spectralRolloff,
    spectralFlatness,
    zeroCrossingRate,
    frequencyRange: {
      min: minFrequency,
      max: maxFrequency
    }
  };
}
async function getTimeVaryingSpectralFeatures(audio, options = {}) {
  const {
    frameSize = 2048,
    hopSize = frameSize / 2,
    fftSize = frameSize,
    windowFunction = "hann",
    channel = 0,
    minFrequency = 0,
    maxFrequency = audio.sampleRate / 2,
    rolloffThreshold = 0.85,
    numFrames
  } = options;
  if (channel >= audio.numberOfChannels) {
    throw new AudioInspectError("INVALID_INPUT", `\u7121\u52B9\u306A\u30C1\u30E3\u30F3\u30CD\u30EB\u756A\u53F7: ${channel}`);
  }
  const samples = audio.channelData[channel];
  if (!samples) {
    throw new AudioInspectError("INVALID_INPUT", `\u30C1\u30E3\u30F3\u30CD\u30EB ${channel} \u306E\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`);
  }
  const totalFrames = numFrames || Math.floor((samples.length - frameSize) / hopSize) + 1;
  if (totalFrames <= 0) {
    throw new AudioInspectError("INVALID_INPUT", "\u30D5\u30EC\u30FC\u30E0\u6570\u304C\u4E0D\u6B63\u3067\u3059");
  }
  const times = new Float32Array(totalFrames);
  const spectralCentroid = new Float32Array(totalFrames);
  const spectralBandwidth = new Float32Array(totalFrames);
  const spectralRolloff = new Float32Array(totalFrames);
  const spectralFlatness = new Float32Array(totalFrames);
  const spectralFlux = new Float32Array(totalFrames);
  const zeroCrossingRate = new Float32Array(totalFrames);
  let previousMagnitude;
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const startSample = frameIndex * hopSize;
    const endSample = Math.min(startSample + frameSize, samples.length);
    times[frameIndex] = startSample / audio.sampleRate;
    const frameData = samples.subarray(startSample, endSample);
    const paddedFrame = new Float32Array(frameSize);
    paddedFrame.set(frameData);
    const frameAudio = {
      channelData: [paddedFrame],
      sampleRate: audio.sampleRate,
      numberOfChannels: 1,
      length: frameSize,
      duration: frameSize / audio.sampleRate
    };
    const features = await getSpectralFeatures(frameAudio, {
      fftSize,
      windowFunction,
      channel: 0,
      minFrequency,
      maxFrequency,
      rolloffThreshold
    });
    spectralCentroid[frameIndex] = features.spectralCentroid;
    spectralBandwidth[frameIndex] = features.spectralBandwidth;
    spectralRolloff[frameIndex] = features.spectralRolloff;
    spectralFlatness[frameIndex] = features.spectralFlatness;
    zeroCrossingRate[frameIndex] = features.zeroCrossingRate;
    const fftResult = await getFFT(frameAudio, { fftSize, windowFunction, channel: 0 });
    spectralFlux[frameIndex] = calculateSpectralFlux(fftResult.magnitude, previousMagnitude);
    previousMagnitude = new Float32Array(fftResult.magnitude);
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

// src/features/energy.ts
function applyEnergyWindow(data, windowType, startIdx, length) {
  const windowed = new Float32Array(length);
  for (let i = 0; i < length && startIdx + i < data.length; i++) {
    let windowValue = 1;
    switch (windowType) {
      case "hann":
        windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)));
        break;
      case "hamming":
        windowValue = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (length - 1));
        break;
      case "rectangular":
      default:
        windowValue = 1;
    }
    const sample = ensureValidSample(data[startIdx + i]);
    windowed[i] = sample * windowValue;
  }
  return windowed;
}
function getEnergy(audio, options = {}) {
  const {
    frameSize = Math.floor(audio.sampleRate * 0.025),
    // 25ms
    hopSize = Math.floor(audio.sampleRate * 0.01),
    // 10ms
    channel = 0,
    normalized = false,
    windowFunction = "rectangular"
  } = options;
  if (frameSize <= 0 || !Number.isInteger(frameSize)) {
    throw new AudioInspectError("INVALID_INPUT", "frameSize\u306F\u6B63\u306E\u6574\u6570\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059");
  }
  if (hopSize <= 0 || !Number.isInteger(hopSize)) {
    throw new AudioInspectError("INVALID_INPUT", "hopSize\u306F\u6B63\u306E\u6574\u6570\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059");
  }
  if (hopSize > frameSize) {
    console.warn(
      "[audio-inspect] hopSize\u304CframeSize\u3088\u308A\u5927\u304D\u3044\u305F\u3081\u3001\u30D5\u30EC\u30FC\u30E0\u9593\u306B\u30AE\u30E3\u30C3\u30D7\u304C\u751F\u3058\u307E\u3059"
    );
  }
  const channelData = getChannelData(audio, channel);
  const dataLength = channelData.length;
  if (dataLength === 0) {
    return {
      times: new Float32Array(0),
      energies: new Float32Array(0),
      totalEnergy: 0,
      statistics: { mean: 0, std: 0, max: 0, min: 0 }
    };
  }
  const frameCount = Math.max(0, Math.floor((dataLength - frameSize) / hopSize) + 1);
  if (frameCount === 0) {
    const energy = calculateFrameEnergy(channelData, 0, dataLength, windowFunction);
    return {
      times: new Float32Array([dataLength / 2 / audio.sampleRate]),
      energies: new Float32Array([energy]),
      totalEnergy: energy,
      statistics: { mean: energy, std: 0, max: energy, min: energy }
    };
  }
  const times = new Float32Array(frameCount);
  const energies = new Float32Array(frameCount);
  let totalEnergy = 0;
  let maxEnergy = -Infinity;
  let minEnergy = Infinity;
  for (let i = 0; i < frameCount; i++) {
    const start = i * hopSize;
    const windowedFrame = applyEnergyWindow(channelData, windowFunction, start, frameSize);
    let frameEnergy = 0;
    for (let j = 0; j < windowedFrame.length; j++) {
      const sample = windowedFrame[j];
      if (sample !== void 0) {
        frameEnergy += sample * sample;
      }
    }
    times[i] = (start + frameSize / 2) / audio.sampleRate;
    energies[i] = frameEnergy;
    totalEnergy += frameEnergy;
    maxEnergy = Math.max(maxEnergy, frameEnergy);
    minEnergy = Math.min(minEnergy, frameEnergy);
  }
  const meanEnergy = totalEnergy / frameCount;
  let varianceSum = 0;
  for (let i = 0; i < frameCount; i++) {
    const energy = energies[i];
    if (energy !== void 0) {
      const diff = energy - meanEnergy;
      varianceSum += diff * diff;
    }
  }
  const stdEnergy = Math.sqrt(varianceSum / frameCount);
  if (normalized && totalEnergy > 1e-10) {
    for (let i = 0; i < energies.length; i++) {
      const currentEnergy = energies[i];
      if (currentEnergy !== void 0) {
        energies[i] = currentEnergy / totalEnergy;
      }
    }
    return {
      times,
      energies,
      totalEnergy: 1,
      statistics: {
        mean: meanEnergy / totalEnergy,
        std: stdEnergy / totalEnergy,
        max: maxEnergy / totalEnergy,
        min: minEnergy / totalEnergy
      }
    };
  }
  return {
    times,
    energies,
    totalEnergy,
    statistics: {
      mean: meanEnergy,
      std: stdEnergy,
      max: maxEnergy,
      min: minEnergy
    }
  };
}
function calculateFrameEnergy(data, start, length, windowFunction) {
  const windowed = applyEnergyWindow(data, windowFunction, start, length);
  let energy = 0;
  for (const sample of windowed) {
    energy += sample * sample;
  }
  return energy;
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
  const { channel = 0, windowSize, hopSize, method = "simple" } = options;
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
      console.warn(
        "[audio-inspect] hopSize\u304CwindowSize\u3088\u308A\u5927\u304D\u3044\u305F\u3081\u3001\u5206\u6790\u7A93\u9593\u306B\u30AE\u30E3\u30C3\u30D7\u304C\u751F\u3058\u307E\u3059"
      );
    }
    const windowSizeSamples = Math.floor(windowSize * audio.sampleRate);
    const hopSizeSamples = Math.floor(hopSize * audio.sampleRate);
    if (windowSizeSamples === 0 || hopSizeSamples === 0) {
      throw new AudioInspectError("INVALID_INPUT", "\u30B5\u30F3\u30D7\u30EB\u30EC\u30FC\u30C8\u306B\u5BFE\u3057\u3066\u7A93\u30B5\u30A4\u30BA\u304C\u5C0F\u3055\u3059\u304E\u307E\u3059");
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

// src/features/stereo.ts
function estimateDelay(left, right, maxDelaySamples = 44) {
  const len = Math.min(left.length, right.length);
  let maxCorr = -Infinity;
  let bestDelay = 0;
  for (let delay = -maxDelaySamples; delay <= maxDelaySamples; delay++) {
    let correlation = 0;
    let count = 0;
    for (let i = 0; i < len; i++) {
      const leftIdx = i;
      const rightIdx = i + delay;
      if (rightIdx >= 0 && rightIdx < len) {
        const leftSample = ensureValidSample(left[leftIdx]);
        const rightSample = ensureValidSample(right[rightIdx]);
        correlation += leftSample * rightSample;
        count++;
      }
    }
    if (count > 0) {
      correlation /= count;
      if (correlation > maxCorr) {
        maxCorr = correlation;
        bestDelay = delay;
      }
    }
  }
  return bestDelay;
}
async function calculateCoherence(left, right, fftSize, sampleRate) {
  const leftFFT = await getFFT(
    {
      channelData: [left],
      sampleRate,
      numberOfChannels: 1,
      length: left.length,
      duration: left.length / sampleRate
    },
    { fftSize }
  );
  const rightFFT = await getFFT(
    {
      channelData: [right],
      sampleRate,
      numberOfChannels: 1,
      length: right.length,
      duration: right.length / sampleRate
    },
    { fftSize }
  );
  const coherence = new Float32Array(leftFFT.magnitude.length);
  for (let i = 0; i < coherence.length; i++) {
    const leftMag = leftFFT.magnitude[i] || 0;
    const rightMag = rightFFT.magnitude[i] || 0;
    const leftPhase = leftFFT.phase[i] || 0;
    const rightPhase = rightFFT.phase[i] || 0;
    const crossReal = leftMag * rightMag * Math.cos(leftPhase - rightPhase);
    const crossImag = leftMag * rightMag * Math.sin(leftPhase - rightPhase);
    const crossMag = Math.sqrt(crossReal * crossReal + crossImag * crossImag);
    const denominator = leftMag * leftMag * rightMag * rightMag;
    coherence[i] = denominator > 1e-10 ? crossMag * crossMag / denominator : 0;
  }
  return coherence;
}
function calculateFrequencyWidth(leftMag, rightMag, leftPhase, rightPhase) {
  const width = new Float32Array(leftMag.length);
  for (let i = 0; i < width.length; i++) {
    const lMag = leftMag[i] || 0;
    const rMag = rightMag[i] || 0;
    const lPhase = leftPhase[i] || 0;
    const rPhase = rightPhase[i] || 0;
    const phaseDiff = lPhase - rPhase;
    const midMag = Math.abs(lMag + rMag) / 2;
    const sideMag = Math.abs(lMag - rMag) / 2;
    const phaseWidth = Math.abs(Math.sin(phaseDiff / 2));
    const magWidth = sideMag / (midMag + sideMag + 1e-10);
    width[i] = Math.max(magWidth, phaseWidth);
  }
  return width;
}
async function getStereoAnalysis(audio, options = {}) {
  if (audio.numberOfChannels < 2) {
    throw new AudioInspectError("INVALID_INPUT", "\u30B9\u30C6\u30EC\u30AA\u89E3\u6790\u306B\u306F2\u30C1\u30E3\u30F3\u30CD\u30EB\u4EE5\u4E0A\u306E\u97F3\u58F0\u304C\u5FC5\u8981\u3067\u3059");
  }
  const {
    frameSize = audio.length,
    calculatePhase = true,
    calculateITD = true,
    calculateILD = true
  } = options;
  const left = audio.channelData[0];
  const right = audio.channelData[1];
  if (!left || !right) {
    throw new AudioInspectError("INVALID_INPUT", "L/R\u30C1\u30E3\u30F3\u30CD\u30EB\u306E\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093");
  }
  const len = Math.min(left.length, right.length);
  if (len === 0) {
    return {
      correlation: 0,
      width: 0,
      balance: 0,
      midSideRatio: 0
    };
  }
  let sumL = 0, sumR = 0, sumLR = 0, sumL2 = 0, sumR2 = 0;
  let energyL = 0, energyR = 0;
  for (let i = 0; i < len; i++) {
    const l = ensureValidSample(left[i]);
    const r = ensureValidSample(right[i]);
    sumL += l;
    sumR += r;
    sumLR += l * r;
    sumL2 += l * l;
    sumR2 += r * r;
    energyL += l * l;
    energyR += r * r;
  }
  const meanL = sumL / len;
  const meanR = sumR / len;
  const covariance = sumLR / len - meanL * meanR;
  const stdL = Math.sqrt(sumL2 / len - meanL * meanL);
  const stdR = Math.sqrt(sumR2 / len - meanR * meanR);
  const correlation = stdL > 1e-10 && stdR > 1e-10 ? covariance / (stdL * stdR) : 0;
  const mid = new Float32Array(len);
  const side = new Float32Array(len);
  let energyMid = 0, energySide = 0;
  for (let i = 0; i < len; i++) {
    const l = ensureValidSample(left[i]);
    const r = ensureValidSample(right[i]);
    mid[i] = (l + r) * 0.5;
    side[i] = (l - r) * 0.5;
    energyMid += (mid[i] ?? 0) * (mid[i] ?? 0);
    energySide += (side[i] ?? 0) * (side[i] ?? 0);
  }
  const width = energyMid + energySide > 1e-10 ? energySide / (energyMid + energySide) : 0;
  const balance = energyL + energyR > 1e-10 ? (energyR - energyL) / (energyL + energyR) : 0;
  const midSideRatio = energySide > 1e-10 ? 10 * Math.log10(energyMid / energySide) : Infinity;
  const result = {
    correlation,
    width,
    balance,
    midSideRatio
  };
  if (calculatePhase && frameSize < audio.length) {
    const fftSize = Math.pow(2, Math.ceil(Math.log2(frameSize)));
    result.coherence = await calculateCoherence(
      left.subarray(0, frameSize),
      right.subarray(0, frameSize),
      fftSize,
      audio.sampleRate
    );
    const leftFFT = await getFFT(
      {
        channelData: [left.subarray(0, frameSize)],
        sampleRate: audio.sampleRate,
        numberOfChannels: 1,
        length: frameSize,
        duration: frameSize / audio.sampleRate
      },
      { fftSize }
    );
    const rightFFT = await getFFT(
      {
        channelData: [right.subarray(0, frameSize)],
        sampleRate: audio.sampleRate,
        numberOfChannels: 1,
        length: frameSize,
        duration: frameSize / audio.sampleRate
      },
      { fftSize }
    );
    result.widthFrequency = calculateFrequencyWidth(
      leftFFT.magnitude,
      rightFFT.magnitude,
      leftFFT.phase,
      rightFFT.phase
    );
    let phaseDiffSum = 0;
    let weightSum = 0;
    for (let i = 1; i < leftFFT.phase.length; i++) {
      const leftMag = leftFFT.magnitude[i] || 0;
      const rightMag = rightFFT.magnitude[i] || 0;
      const leftPhase = leftFFT.phase[i] || 0;
      const rightPhase = rightFFT.phase[i] || 0;
      const weight = leftMag * rightMag;
      let phaseDiff = leftPhase - rightPhase;
      while (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
      while (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;
      phaseDiffSum += phaseDiff * weight;
      weightSum += weight;
    }
    result.phaseDifference = weightSum > 1e-10 ? phaseDiffSum / weightSum * 180 / Math.PI : 0;
  }
  if (calculateITD) {
    const delaySamples = estimateDelay(left, right);
    result.itd = delaySamples / audio.sampleRate * 1e3;
  }
  if (calculateILD) {
    const rmsL = Math.sqrt(energyL / len);
    const rmsR = Math.sqrt(energyR / len);
    result.ild = rmsL > 1e-10 && rmsR > 1e-10 ? 20 * Math.log10(rmsR / rmsL) : 0;
  }
  result.goniometer = {
    x: side,
    // L-R
    y: mid
    // L+R
  };
  return result;
}
function getTimeVaryingStereoAnalysis(_audio, _options = {}) {
  return Promise.reject(
    new AudioInspectError(
      "UNSUPPORTED_FORMAT",
      "\u6642\u7CFB\u5217\u30B9\u30C6\u30EC\u30AA\u89E3\u6790\u306F\u5C06\u6765\u306E\u30D0\u30FC\u30B8\u30E7\u30F3\u3067\u5B9F\u88C5\u4E88\u5B9A\u3067\u3059"
    )
  );
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

// src/features/loudness.ts
var ABSOLUTE_GATE_LUFS = -70;
var RELATIVE_GATE_LU = 10;
var BLOCK_SIZE_MS = 400;
var BLOCK_OVERLAP = 0.75;
var SHORT_TERM_WINDOW_MS = 3e3;
var MOMENTARY_WINDOW_MS = 400;
var K_WEIGHTING_STAGE1 = {
  // High-pass filter (Butterworth)
  b: [1.53512485958697, -2.69169618940638, 1.19839281085285],
  a: [1, -1.69065929318241, 0.73248077421585]
};
var K_WEIGHTING_STAGE2 = {
  // High-frequency shelf
  b: [1.53660026327012, -2.68908427791073, 1.16158667615261],
  a: [1, -1.68859431835989, 0.72909998803284]
};
function applyBiquad(input, b, a, state = { x1: 0, x2: 0, y1: 0, y2: 0 }) {
  const output = new Float32Array(input.length);
  let { x1, x2, y1, y2 } = state;
  for (let i = 0; i < input.length; i++) {
    const x0 = ensureValidSample(input[i]);
    const b0 = b[0] ?? 0;
    const b1 = b[1] ?? 0;
    const b2 = b[2] ?? 0;
    const a1 = a[1] ?? 0;
    const a2 = a[2] ?? 0;
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    output[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  state.x1 = x1;
  state.x2 = x2;
  state.y1 = y1;
  state.y2 = y2;
  return output;
}
function applyKWeighting(channelData) {
  let filtered = applyBiquad(channelData, K_WEIGHTING_STAGE1.b, K_WEIGHTING_STAGE1.a);
  filtered = applyBiquad(filtered, K_WEIGHTING_STAGE2.b, K_WEIGHTING_STAGE2.a);
  return filtered;
}
function calculateBlockLoudness(channels) {
  let sumOfSquares = 0;
  const numChannels = channels.length;
  if (numChannels === 0) return -Infinity;
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = channels[ch];
    if (!channelData || channelData.length === 0) continue;
    let channelSum = 0;
    let validSamples = 0;
    for (let i = 0; i < channelData.length; i++) {
      const sample = ensureValidSample(channelData[i]);
      channelSum += sample * sample;
      validSamples++;
    }
    if (validSamples === 0) continue;
    const channelWeight = 1;
    sumOfSquares += channelWeight * (channelSum / validSamples);
  }
  return -0.691 + 10 * Math.log10(Math.max(1e-15, sumOfSquares));
}
function getLUFS(audio, options = {}) {
  const {
    channelMode = audio.numberOfChannels >= 2 ? "stereo" : "mono",
    gated = true,
    calculateShortTerm = false,
    calculateMomentary = false,
    calculateLoudnessRange = false,
    calculateTruePeak = false
  } = options;
  if (audio.numberOfChannels === 0) {
    throw new AudioInspectError("INVALID_INPUT", "\u51E6\u7406\u53EF\u80FD\u306A\u30C1\u30E3\u30F3\u30CD\u30EB\u304C\u3042\u308A\u307E\u305B\u3093");
  }
  const channelsToProcess = [];
  if (channelMode === "mono") {
    const channel0 = audio.channelData[0];
    if (channel0) {
      channelsToProcess.push(channel0);
    }
  } else {
    const channel0 = audio.channelData[0];
    const channel1 = audio.channelData[1];
    if (channel0) channelsToProcess.push(channel0);
    if (channel1) channelsToProcess.push(channel1);
  }
  if (channelsToProcess.length === 0) {
    throw new AudioInspectError("INVALID_INPUT", "\u51E6\u7406\u53EF\u80FD\u306A\u30C1\u30E3\u30F3\u30CD\u30EB\u304C\u3042\u308A\u307E\u305B\u3093");
  }
  const kWeightedChannels = channelsToProcess.map((ch) => applyKWeighting(ch));
  const sampleRate = audio.sampleRate;
  const blockSizeSamples = Math.floor(BLOCK_SIZE_MS / 1e3 * sampleRate);
  const hopSizeSamples = Math.floor(blockSizeSamples * (1 - BLOCK_OVERLAP));
  const dataLength = kWeightedChannels[0]?.length ?? 0;
  if (dataLength === 0) {
    return { integrated: -Infinity };
  }
  const blockLoudnessValues = [];
  for (let pos = 0; pos + blockSizeSamples <= dataLength; pos += hopSizeSamples) {
    const blockChannels = kWeightedChannels.map((ch) => ch.subarray(pos, pos + blockSizeSamples));
    const loudness = calculateBlockLoudness(blockChannels);
    if (isFinite(loudness)) {
      blockLoudnessValues.push(loudness);
    }
  }
  let integratedLoudness = -Infinity;
  if (blockLoudnessValues.length > 0) {
    let finalLoudnessValues = [...blockLoudnessValues];
    if (gated) {
      finalLoudnessValues = finalLoudnessValues.filter((l) => l >= ABSOLUTE_GATE_LUFS);
      if (finalLoudnessValues.length > 0) {
        const sumPower = finalLoudnessValues.reduce((sum, lufs) => {
          return sum + Math.pow(10, (lufs + 0.691) / 10);
        }, 0);
        const meanLoudness = -0.691 + 10 * Math.log10(sumPower / finalLoudnessValues.length);
        const relativeThreshold = meanLoudness - RELATIVE_GATE_LU;
        finalLoudnessValues = finalLoudnessValues.filter((l) => l >= relativeThreshold);
      }
    }
    if (finalLoudnessValues.length > 0) {
      const sumPower = finalLoudnessValues.reduce((sum, lufs) => {
        return sum + Math.pow(10, (lufs + 0.691) / 10);
      }, 0);
      integratedLoudness = -0.691 + 10 * Math.log10(sumPower / finalLoudnessValues.length);
    }
  }
  const result = {
    integrated: integratedLoudness
  };
  if (calculateShortTerm) {
    const shortTermSamples = Math.floor(SHORT_TERM_WINDOW_MS / 1e3 * sampleRate);
    const shortTermHop = hopSizeSamples;
    const shortTermValues = [];
    for (let pos = 0; pos + shortTermSamples <= dataLength; pos += shortTermHop) {
      const windowChannels = kWeightedChannels.map(
        (ch) => ch.subarray(pos, pos + shortTermSamples)
      );
      const loudness = calculateBlockLoudness(windowChannels);
      if (isFinite(loudness)) {
        shortTermValues.push(loudness);
      }
    }
    result.shortTerm = new Float32Array(shortTermValues);
  }
  if (calculateMomentary) {
    const momentarySamples = Math.floor(MOMENTARY_WINDOW_MS / 1e3 * sampleRate);
    const momentaryHop = hopSizeSamples;
    const momentaryValues = [];
    for (let pos = 0; pos + momentarySamples <= dataLength; pos += momentaryHop) {
      const windowChannels = kWeightedChannels.map(
        (ch) => ch.subarray(pos, pos + momentarySamples)
      );
      const loudness = calculateBlockLoudness(windowChannels);
      if (isFinite(loudness)) {
        momentaryValues.push(loudness);
      }
    }
    result.momentary = new Float32Array(momentaryValues);
  }
  if (calculateLoudnessRange && result.shortTerm) {
    const validValues = Array.from(result.shortTerm).filter((v) => v > ABSOLUTE_GATE_LUFS && isFinite(v)).sort((a, b) => a - b);
    if (validValues.length > 0) {
      const percentile10Index = Math.floor(validValues.length * 0.1);
      const percentile95Index = Math.floor(validValues.length * 0.95);
      const percentile10 = validValues[percentile10Index] ?? -Infinity;
      const percentile95 = validValues[percentile95Index] ?? -Infinity;
      result.loudnessRange = percentile95 - percentile10;
      result.statistics = { percentile10, percentile95 };
    }
  }
  if (calculateTruePeak) {
    result.truePeak = channelsToProcess.map((ch) => {
      let peak = 0;
      for (const sample of ch) {
        const sampleValue = ensureValidSample(sample);
        peak = Math.max(peak, Math.abs(sampleValue));
      }
      return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
    });
  }
  return result;
}
//# sourceMappingURL=index.cjs.map