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
export {
  getPeaks,
  getRMS,
  getWaveform,
  getZeroCrossing
};
//# sourceMappingURL=time.js.map