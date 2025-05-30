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

// src/core/utils.ts
function isValidSample(value) {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
}
function ensureValidSample(value, defaultValue = 0) {
  return isValidSample(value) ? value : defaultValue;
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
    throw new AudioInspectError(
      "INVALID_INPUT",
      "\u30B9\u30C6\u30EC\u30AA\u89E3\u6790\u306B\u306F2\u30C1\u30E3\u30F3\u30CD\u30EB\u4EE5\u4E0A\u306E\u97F3\u58F0\u304C\u5FC5\u8981\u3067\u3059"
    );
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
    throw new AudioInspectError(
      "INVALID_INPUT",
      "L/R\u30C1\u30E3\u30F3\u30CD\u30EB\u306E\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093"
    );
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
  return Promise.reject(new AudioInspectError(
    "UNSUPPORTED_FORMAT",
    "\u6642\u7CFB\u5217\u30B9\u30C6\u30EC\u30AA\u89E3\u6790\u306F\u5C06\u6765\u306E\u30D0\u30FC\u30B8\u30E7\u30F3\u3067\u5B9F\u88C5\u4E88\u5B9A\u3067\u3059"
  ));
}
export {
  getStereoAnalysis,
  getTimeVaryingStereoAnalysis
};
//# sourceMappingURL=stereo.js.map