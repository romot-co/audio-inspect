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
    throw new AudioInspectError(
      "INVALID_INPUT",
      "frameSize\u306F\u6B63\u306E\u6574\u6570\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059"
    );
  }
  if (hopSize <= 0 || !Number.isInteger(hopSize)) {
    throw new AudioInspectError(
      "INVALID_INPUT",
      "hopSize\u306F\u6B63\u306E\u6574\u6570\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059"
    );
  }
  if (hopSize > frameSize) {
    console.warn("[audio-inspect] hopSize\u304CframeSize\u3088\u308A\u5927\u304D\u3044\u305F\u3081\u3001\u30D5\u30EC\u30FC\u30E0\u9593\u306B\u30AE\u30E3\u30C3\u30D7\u304C\u751F\u3058\u307E\u3059");
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
export {
  getEnergy
};
//# sourceMappingURL=energy.js.map