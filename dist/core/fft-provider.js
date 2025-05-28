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
    this.initializeWebFFT();
  }
  fftInstance;
  get name() {
    return "WebFFT";
  }
  async initializeWebFFT() {
    try {
      const WebFFT = (await import("webfft")).default;
      this.fftInstance = new WebFFT(this.size);
      if (this.enableProfiling) {
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
    if (!this.fftInstance) {
      throw new AudioInspectError("UNSUPPORTED_FORMAT", "WebFFT\u304C\u521D\u671F\u5316\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
    }
    return this.fftInstance.profile();
  }
  dispose() {
    if (this.fftInstance) {
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
      throw new AudioInspectError("INVALID_INPUT", "FFT\u30B5\u30A4\u30BA\u306F2\u306E\u7D2F\u4E57\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059");
    }
  }
  get name() {
    return "Native DFT";
  }
  isPowerOfTwo(n) {
    return n > 0 && (n & n - 1) === 0;
  }
  fft(input) {
    if (input.length !== this.size) {
      throw new AudioInspectError(
        "INVALID_INPUT",
        `\u5165\u529B\u30B5\u30A4\u30BA\u304C\u4E0D\u6B63\u3067\u3059\u3002\u671F\u5F85\u5024: ${this.size}, \u5B9F\u969B: ${input.length}`
      );
    }
    const complex = new Float32Array(this.size * 2);
    const magnitude = new Float32Array(this.size / 2 + 1);
    const phase = new Float32Array(this.size / 2 + 1);
    const frequencies = new Float32Array(this.size / 2 + 1);
    for (let k = 0; k < this.size; k++) {
      let realSum = 0;
      let imagSum = 0;
      for (let n = 0; n < this.size; n++) {
        const angle = -2 * Math.PI * k * n / this.size;
        realSum += input[n] * Math.cos(angle);
        imagSum += input[n] * Math.sin(angle);
      }
      complex[k * 2] = realSum;
      complex[k * 2 + 1] = imagSum;
      if (k <= this.size / 2) {
        magnitude[k] = Math.sqrt(realSum * realSum + imagSum * imagSum);
        phase[k] = Math.atan2(imagSum, realSum);
        frequencies[k] = k * this.sampleRate / this.size;
      }
    }
    return {
      complex,
      magnitude,
      phase,
      frequencies
    };
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
      case "webfft":
        const provider = new WebFFTProvider(
          config.fftSize,
          config.sampleRate,
          config.enableProfiling
        );
        await provider["initializeWebFFT"]();
        return provider;
      case "native":
        return new NativeFFTProvider(config.fftSize, config.sampleRate);
      case "custom":
        if (!config.customProvider) {
          throw new AudioInspectError("INVALID_INPUT", "\u30AB\u30B9\u30BF\u30E0\u30D7\u30ED\u30D0\u30A4\u30C0\u30FC\u304C\u6307\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
        }
        return config.customProvider;
      default:
        throw new AudioInspectError(
          "UNSUPPORTED_FORMAT",
          `\u672A\u5BFE\u5FDC\u306EFFT\u30D7\u30ED\u30D0\u30A4\u30C0\u30FC: ${config.type}`
        );
    }
  }
  /**
   * 利用可能なプロバイダーをリスト
   */
  static getAvailableProviders() {
    return ["webfft", "native"];
  }
};
export {
  FFTProviderFactory
};
//# sourceMappingURL=fft-provider.js.map