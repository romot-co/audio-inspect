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
    const blockChannels = kWeightedChannels.map(
      (ch) => ch.subarray(pos, pos + blockSizeSamples)
    );
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
export {
  getLUFS
};
//# sourceMappingURL=loudness.js.map