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
function isValidSample(value) {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
}
function ensureValidSample(value, defaultValue = 0) {
  return isValidSample(value) ? value : defaultValue;
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
    throw new AudioInspectError(
      "INVALID_INPUT",
      `\u7121\u52B9\u306A\u30C1\u30E3\u30F3\u30CD\u30EB\u756A\u53F7: ${channel}`
    );
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
  const spectralFlatness = calculateSpectralFlatness(
    fftResult.magnitude,
    minIndex,
    maxIndex
  );
  const samples = audio.channelData[channel];
  if (!samples) {
    throw new AudioInspectError(
      "INVALID_INPUT",
      `\u30C1\u30E3\u30F3\u30CD\u30EB ${channel} \u306E\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`
    );
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
    throw new AudioInspectError(
      "INVALID_INPUT",
      `\u7121\u52B9\u306A\u30C1\u30E3\u30F3\u30CD\u30EB\u756A\u53F7: ${channel}`
    );
  }
  const samples = audio.channelData[channel];
  if (!samples) {
    throw new AudioInspectError(
      "INVALID_INPUT",
      `\u30C1\u30E3\u30F3\u30CD\u30EB ${channel} \u306E\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`
    );
  }
  const totalFrames = numFrames || Math.floor((samples.length - frameSize) / hopSize) + 1;
  if (totalFrames <= 0) {
    throw new AudioInspectError(
      "INVALID_INPUT",
      "\u30D5\u30EC\u30FC\u30E0\u6570\u304C\u4E0D\u6B63\u3067\u3059"
    );
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
export {
  getSpectralFeatures,
  getTimeVaryingSpectralFeatures
};
//# sourceMappingURL=spectral.js.map