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

// src/features/frequency.ts
var frequency_exports = {};
__export(frequency_exports, {
  getFFT: () => getFFT,
  getSpectrum: () => getSpectrum
});
module.exports = __toCommonJS(frequency_exports);

// src/types.ts
var AudioInspectError = class extends Error {
  constructor(code, message, cause) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
  name = "AudioInspectError";
};

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
      throw new AudioInspectError(
        "INVALID_INPUT",
        "FFT\u30B5\u30A4\u30BA\u306F2\u306E\u51AA\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059"
      );
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
function getChannelData(audio, channel) {
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
  if (channel < 0 || channel >= audio.numberOfChannels) {
    throw new AudioInspectError("INVALID_INPUT", `\u7121\u52B9\u306A\u30C1\u30E3\u30F3\u30CD\u30EB\u756A\u53F7: ${channel}`);
  }
  const channelData = audio.channelData[channel];
  if (!channelData) {
    throw new AudioInspectError("INVALID_INPUT", `\u30C1\u30E3\u30F3\u30CD\u30EB ${channel} \u306E\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`);
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
  const channelData = getChannelData(audio, channel);
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
  const channelData = getChannelData(audio, options.channel || 0);
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
  const actualFrames = Math.min(timeFrames, Math.floor((data.length - fftSize) / hopSize) + 1);
  const times = new Float32Array(actualFrames);
  const intensities = [];
  let frequencies = new Float32Array();
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
      for (let i = 0; i < fftSize && startSample + i < data.length; i++) {
        frameData[i] = data[startSample + i] || 0;
      }
      const windowedData = applyWindow(frameData, options.windowFunction || "hann");
      const fftResult = fftProvider.fft(windowedData);
      if (frame === 0) {
        frequencies = fftResult.frequencies;
      }
      const magnitude = fftResult.magnitude;
      const frameIntensity = options.decibels ? magnitudeToDecibels(magnitude) : magnitude;
      intensities.push(frameIntensity);
      times[frame] = (startSample + fftSize / 2) / sampleRate;
    }
  } finally {
    fftProvider.dispose();
  }
  return {
    times,
    frequencies,
    intensities,
    timeFrames: actualFrames,
    frequencyBins: frequencies.length
  };
}
//# sourceMappingURL=frequency.cjs.map