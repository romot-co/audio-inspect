import { AudioData, AudioInspectError, type ChannelSelector } from '../types.js';
import { getChannelData, ensureValidSample } from '../core/utils.js';

export interface EnergyOptions {
  frameSize?: number;
  hopSize?: number;
  channel?: ChannelSelector;
  normalized?: boolean;
  windowFunction?: 'rectangular' | 'hann' | 'hamming' | 'blackman' | 'none'; // エネルギー計算用の窓関数
}

export interface EnergyResult {
  times: Float32Array;
  energies: Float32Array;
  totalEnergy: number;
  statistics: {
    mean: number;
    std: number;
    max: number;
    min: number;
  };
}

// 窓関数の適用（エネルギー計算用）
function applyEnergyWindow(
  data: Float32Array,
  windowType: string,
  startIdx: number,
  length: number
): Float32Array {
  const windowed = new Float32Array(length);

  for (let i = 0; i < length && startIdx + i < data.length; i++) {
    let windowValue = 1.0;

    if (length > 1) {
      switch (windowType) {
        case 'hann':
          windowValue = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
          break;
        case 'hamming':
          windowValue = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (length - 1));
          break;
        case 'blackman':
          windowValue =
            0.42 -
            0.5 * Math.cos((2 * Math.PI * i) / (length - 1)) +
            0.08 * Math.cos((4 * Math.PI * i) / (length - 1));
          break;
        case 'rectangular':
        case 'none':
        default:
          windowValue = 1.0;
      }
    }

    const sample = ensureValidSample(data[startIdx + i] ?? 0);
    windowed[i] = sample * windowValue;
  }

  return windowed;
}

export function getEnergy(audio: AudioData, options: EnergyOptions = {}): EnergyResult {
  const {
    frameSize = Math.floor(audio.sampleRate * 0.025), // 25ms
    hopSize = Math.floor(audio.sampleRate * 0.01), // 10ms
    channel = 0,
    normalized = false,
    windowFunction = 'rectangular'
  } = options;

  // パラメータの検証
  if (frameSize <= 0 || !Number.isInteger(frameSize)) {
    throw new AudioInspectError('INVALID_INPUT', 'frameSizeは正の整数である必要があります');
  }

  if (hopSize <= 0 || !Number.isInteger(hopSize)) {
    throw new AudioInspectError('INVALID_INPUT', 'hopSizeは正の整数である必要があります');
  }

  if (hopSize > frameSize) {
    console.warn(
      '[audio-inspect] hopSizeがframeSizeより大きいため、フレーム間にギャップが生じます'
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

  // フレーム数の計算
  const frameCount = Math.max(0, Math.floor((dataLength - frameSize) / hopSize) + 1);

  if (frameCount === 0) {
    // データが1フレーム分に満たない場合
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

  // 各フレームのエネルギー計算
  for (let i = 0; i < frameCount; i++) {
    const start = i * hopSize;
    const windowedFrame = applyEnergyWindow(channelData, windowFunction, start, frameSize);

    let frameEnergy = 0;
    for (let j = 0; j < windowedFrame.length; j++) {
      const sample = windowedFrame[j];
      if (sample !== undefined) {
        frameEnergy += sample * sample;
      }
    }

    times[i] = (start + frameSize / 2) / audio.sampleRate;
    energies[i] = frameEnergy;
    totalEnergy += frameEnergy;

    maxEnergy = Math.max(maxEnergy, frameEnergy);
    minEnergy = Math.min(minEnergy, frameEnergy);
  }

  // 統計情報の計算
  const meanEnergy = totalEnergy / frameCount;
  let varianceSum = 0;

  for (let i = 0; i < frameCount; i++) {
    const energy = energies[i];
    if (energy !== undefined) {
      const diff = energy - meanEnergy;
      varianceSum += diff * diff;
    }
  }

  const stdEnergy = Math.sqrt(varianceSum / frameCount);

  // 正規化（オプション）
  if (normalized && totalEnergy > 1e-10) {
    for (let i = 0; i < energies.length; i++) {
      const currentEnergy = energies[i];
      if (currentEnergy !== undefined) {
        energies[i] = currentEnergy / totalEnergy;
      }
    }

    return {
      times,
      energies,
      totalEnergy: 1.0,
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

// ヘルパー関数
function calculateFrameEnergy(
  data: Float32Array,
  start: number,
  length: number,
  windowFunction: string
): number {
  const windowed = applyEnergyWindow(data, windowFunction, start, length);
  let energy = 0;
  for (const sample of windowed) {
    energy += sample * sample;
  }
  return energy;
}
