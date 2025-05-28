// audio-inspect - 軽量かつ高機能なオーディオ解析ライブラリ

// src/types.ts
var AudioInspectError = class extends Error {
  constructor(code, message, cause) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
  name = "AudioInspectError";
};
function isAudioInspectError(error) {
  return error instanceof AudioInspectError;
}

// src/core/load.ts
async function load(source, options = {}) {
  try {
    if (isAudioData(source)) {
      return processAudioData(source, options);
    }
    const audioContext = getAudioContext();
    const audioBuffer = await decodeAudioSource(source, audioContext);
    const audioData = audioBufferToAudioData(audioBuffer);
    return processAudioData(audioData, options);
  } catch (error) {
    throw new AudioInspectError(
      "DECODE_ERROR",
      `\u97F3\u58F0\u30C7\u30FC\u30BF\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error instanceof Error ? error.message : "Unknown error"}`,
      error
    );
  }
}
function isAudioData(source) {
  return typeof source === "object" && source !== null && "sampleRate" in source && "channelData" in source && "duration" in source && "numberOfChannels" in source && "length" in source;
}
function getAudioContext() {
  if (typeof AudioContext !== "undefined") {
    return new AudioContext();
  }
  throw new AudioInspectError("UNSUPPORTED_FORMAT", "\u3053\u306E\u74B0\u5883\u3067\u306FWeb Audio API\u304C\u5229\u7528\u3067\u304D\u307E\u305B\u3093");
}
async function decodeAudioSource(source, audioContext) {
  if (source instanceof AudioBuffer) {
    return source;
  }
  if (source instanceof ArrayBuffer) {
    return await audioContext.decodeAudioData(source);
  }
  if (source instanceof Blob || source instanceof File) {
    const arrayBuffer = await source.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  }
  if (typeof source === "string" || source instanceof URL) {
    const url = source instanceof URL ? source.href : source;
    const response = await fetch(url);
    if (!response.ok) {
      throw new AudioInspectError(
        "NETWORK_ERROR",
        `\u97F3\u58F0\u30D5\u30A1\u30A4\u30EB\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${response.status}`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  }
  if (source instanceof MediaStream) {
    throw new AudioInspectError(
      "UNSUPPORTED_FORMAT",
      "MediaStream\u306E\u51E6\u7406\u306F\u73FE\u5728\u30B5\u30DD\u30FC\u30C8\u3055\u308C\u3066\u3044\u307E\u305B\u3093"
    );
  }
  throw new AudioInspectError("INVALID_INPUT", "\u30B5\u30DD\u30FC\u30C8\u3055\u308C\u3066\u3044\u306A\u3044\u97F3\u58F0\u30BD\u30FC\u30B9\u3067\u3059");
}
function audioBufferToAudioData(buffer) {
  const channelData = [];
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    channelData.push(buffer.getChannelData(channel));
  }
  return {
    sampleRate: buffer.sampleRate,
    channelData,
    duration: buffer.duration,
    numberOfChannels: buffer.numberOfChannels,
    length: buffer.length
  };
}
function processAudioData(audioData, options) {
  let result = audioData;
  if (options.channels === "mono" || options.channels === 1) {
    result = convertToMono(result);
  }
  if (options.normalize) {
    result = normalize(result);
  }
  if (options.sampleRate && options.sampleRate !== result.sampleRate) {
    console.warn("\u30B5\u30F3\u30D7\u30EB\u30EC\u30FC\u30C8\u5909\u63DB\u306F\u73FE\u5728\u30B5\u30DD\u30FC\u30C8\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
  }
  return result;
}
function convertToMono(audioData) {
  if (audioData.numberOfChannels === 1) {
    return audioData;
  }
  const monoData = new Float32Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    let sum = 0;
    for (let channel = 0; channel < audioData.numberOfChannels; channel++) {
      sum += audioData.channelData[channel][i];
    }
    monoData[i] = sum / audioData.numberOfChannels;
  }
  return {
    sampleRate: audioData.sampleRate,
    channelData: [monoData],
    duration: audioData.duration,
    numberOfChannels: 1,
    length: audioData.length
  };
}
function normalize(audioData) {
  let maxAmplitude = 0;
  for (const channelData of audioData.channelData) {
    for (const sample of channelData) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
    }
  }
  if (maxAmplitude === 0) {
    return audioData;
  }
  const normalizedChannels = audioData.channelData.map((channelData) => {
    const normalized = new Float32Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      normalized[i] = channelData[i] / maxAmplitude;
    }
    return normalized;
  });
  return {
    ...audioData,
    channelData: normalizedChannels
  };
}

// src/core/analyze.ts
async function analyze(audio, feature) {
  try {
    validateAudioData(audio);
    const result = await feature(audio);
    return result;
  } catch (error) {
    if (error instanceof AudioInspectError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new AudioInspectError(
      "PROCESSING_ERROR",
      `\u7279\u5FB4\u91CF\u306E\u62BD\u51FA\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${message}`,
      error
    );
  }
}
function validateAudioData(audio) {
  if (!audio || typeof audio !== "object") {
    throw new AudioInspectError("INVALID_INPUT", "AudioData\u304C\u7121\u52B9\u3067\u3059");
  }
  if (typeof audio.sampleRate !== "number" || audio.sampleRate <= 0) {
    throw new AudioInspectError("INVALID_INPUT", "\u30B5\u30F3\u30D7\u30EB\u30EC\u30FC\u30C8\u304C\u7121\u52B9\u3067\u3059");
  }
  if (!Array.isArray(audio.channelData) || audio.channelData.length === 0) {
    throw new AudioInspectError("INVALID_INPUT", "\u30C1\u30E3\u30F3\u30CD\u30EB\u30C7\u30FC\u30BF\u304C\u7121\u52B9\u3067\u3059");
  }
  if (typeof audio.numberOfChannels !== "number" || audio.numberOfChannels !== audio.channelData.length) {
    throw new AudioInspectError("INVALID_INPUT", "\u30C1\u30E3\u30F3\u30CD\u30EB\u6570\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093");
  }
  if (typeof audio.length !== "number" || audio.length <= 0) {
    throw new AudioInspectError("INVALID_INPUT", "\u30C7\u30FC\u30BF\u9577\u304C\u7121\u52B9\u3067\u3059");
  }
  if (typeof audio.duration !== "number" || audio.duration <= 0) {
    throw new AudioInspectError("INVALID_INPUT", "\u97F3\u58F0\u306E\u9577\u3055\u304C\u7121\u52B9\u3067\u3059");
  }
  const expectedLength = audio.channelData[0].length;
  for (let i = 0; i < audio.channelData.length; i++) {
    const channelData = audio.channelData[i];
    if (!(channelData instanceof Float32Array)) {
      throw new AudioInspectError(
        "INVALID_INPUT",
        `\u30C1\u30E3\u30F3\u30CD\u30EB ${i} \u306E\u30C7\u30FC\u30BF\u304C Float32Array \u3067\u306F\u3042\u308A\u307E\u305B\u3093`
      );
    }
    if (channelData.length !== expectedLength) {
      throw new AudioInspectError("INVALID_INPUT", `\u30C1\u30E3\u30F3\u30CD\u30EB ${i} \u306E\u30C7\u30FC\u30BF\u9577\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093`);
    }
  }
}

// src/core/stream.ts
function stream(_source, _feature, _options) {
  throw new AudioInspectError(
    "UNSUPPORTED_FORMAT",
    "stream\u6A5F\u80FD\u306F\u73FE\u5728\u5B9F\u88C5\u4E2D\u3067\u3059\u3002\u6B21\u306E\u30D0\u30FC\u30B8\u30E7\u30F3\u3067\u5229\u7528\u53EF\u80FD\u306B\u306A\u308A\u307E\u3059\u3002"
  );
}

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

// src/features/time.ts
function getPeaks(audio, options = {}) {
  const {
    count = 100,
    threshold = 0.1,
    channel = 0,
    minDistance = Math.floor(audio.sampleRate / 100)
  } = options;
  const channelData = getChannelData(audio, channel);
  const peakCandidates = findPeakCandidates(channelData, threshold, minDistance);
  const sortedPeaks = peakCandidates.sort((a, b) => b.amplitude - a.amplitude).slice(0, count);
  sortedPeaks.sort((a, b) => a.position - b.position);
  const maxAmplitude = peakCandidates.length > 0 ? Math.max(...peakCandidates.map((p) => p.amplitude)) : 0;
  const averageAmplitude = peakCandidates.length > 0 ? peakCandidates.reduce((sum, p) => sum + p.amplitude, 0) / peakCandidates.length : 0;
  return {
    peaks: sortedPeaks.map((candidate) => ({
      position: candidate.position,
      time: candidate.position / audio.sampleRate,
      amplitude: candidate.amplitude
    })),
    maxAmplitude,
    averageAmplitude
  };
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
    throw new Error(`\u7121\u52B9\u306A\u30C1\u30E3\u30F3\u30CD\u30EB\u756A\u53F7: ${channel}`);
  }
  const channelData = audio.channelData[channel];
  if (!channelData) {
    throw new Error(`\u30C1\u30E3\u30F3\u30CD\u30EB ${channel} \u306E\u30C7\u30FC\u30BF\u304C\u5B58\u5728\u3057\u307E\u305B\u3093`);
  }
  return channelData;
}
function findPeakCandidates(data, threshold, minDistance) {
  const peaks = [];
  const length = data.length;
  for (let i = 1; i < length - 1; i++) {
    const current = Math.abs(data[i]);
    const prev = Math.abs(data[i - 1]);
    const next = Math.abs(data[i + 1]);
    if (current > prev && current > next && current > threshold) {
      let shouldAdd = true;
      let replaceIndex = -1;
      for (let j = 0; j < peaks.length; j++) {
        const peak = peaks[j];
        const distance = Math.abs(peak.position - i);
        if (distance < minDistance) {
          if (current > peak.amplitude) {
            replaceIndex = j;
          }
          shouldAdd = false;
          break;
        }
      }
      if (replaceIndex >= 0) {
        peaks[replaceIndex] = {
          position: i,
          time: 0,
          amplitude: current
        };
      } else if (shouldAdd) {
        peaks.push({
          position: i,
          time: 0,
          amplitude: current
        });
      }
    }
  }
  return peaks;
}
function getRMS(audio, channel = 0) {
  const channelData = getChannelData(audio, channel);
  let sum = 0;
  for (let i = 0; i < channelData.length; i++) {
    const sample = channelData[i];
    sum += sample * sample;
  }
  return Math.sqrt(sum / channelData.length);
}
function getZeroCrossing(audio, channel = 0) {
  const channelData = getChannelData(audio, channel);
  let crossings = 0;
  for (let i = 1; i < channelData.length; i++) {
    const prev = channelData[i - 1];
    const current = channelData[i];
    if (prev >= 0 && current < 0 || prev < 0 && current >= 0) {
      crossings++;
    }
  }
  return crossings / (channelData.length - 1);
}
function getWaveform(audio, options = {}) {
  const { framesPerSecond = 60, channel = 0, method = "rms" } = options;
  const channelData = getChannelData(audio, channel);
  const frameCount = Math.ceil(audio.duration * framesPerSecond);
  const samplesPerFrame = Math.floor(audio.length / frameCount);
  const waveform = [];
  let maxAmplitude = 0;
  let totalAmplitude = 0;
  for (let i = 0; i < frameCount; i++) {
    const startSample = i * samplesPerFrame;
    const endSample = Math.min(startSample + samplesPerFrame, channelData.length);
    const frameData = channelData.slice(startSample, endSample);
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
  let sum = 0;
  for (let i = 0; i < frameData.length; i++) {
    const sample = frameData[i];
    sum += sample * sample;
  }
  return Math.sqrt(sum / frameData.length);
}
function calculatePeakAmplitude(frameData) {
  let peak = 0;
  for (let i = 0; i < frameData.length; i++) {
    const sample = Math.abs(frameData[i]);
    peak = Math.max(peak, sample);
  }
  return peak;
}
function calculateAverageAmplitude(frameData) {
  let sum = 0;
  for (let i = 0; i < frameData.length; i++) {
    sum += Math.abs(frameData[i]);
  }
  return frameData.length > 0 ? sum / frameData.length : 0;
}

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
export {
  AudioInspectError,
  FFTProviderFactory,
  analyze,
  getFFT,
  getPeaks,
  getRMS,
  getSpectrum,
  getWaveform,
  getZeroCrossing,
  isAudioInspectError,
  load,
  stream
};
//# sourceMappingURL=index.js.map