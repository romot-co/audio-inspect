import { AudioData, AudioInspectError, type ChannelSelector } from '../types.js';
import { getChannelData } from '../core/utils.js';
import { forEachFrame } from '../core/dsp/frame-iterator.js';
import { getWindow } from '../core/dsp/window.js';

export interface EnergyOptions {
  frameSize?: number;
  hopSize?: number;
  channel?: ChannelSelector;
  normalized?: boolean;
  windowFunction?: 'rectangular' | 'hann' | 'hamming' | 'blackman' | 'none';
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

function calculateFrameEnergy(frame: Float32Array, window: Float32Array | null): number {
  let energy = 0;
  for (let i = 0; i < frame.length; i++) {
    const sample = frame[i]!;
    const weighted = window ? sample * window[i]! : sample;
    energy += weighted * weighted;
  }
  return energy;
}

export function getEnergy(audio: AudioData, options: EnergyOptions = {}): EnergyResult {
  const {
    frameSize = Math.floor(audio.sampleRate * 0.025),
    hopSize = Math.floor(audio.sampleRate * 0.01),
    channel = 'mix',
    normalized = false,
    windowFunction = 'rectangular'
  } = options;

  if (!Number.isInteger(frameSize) || frameSize <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'frameSize must be a positive integer');
  }
  if (!Number.isInteger(hopSize) || hopSize <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'hopSize must be a positive integer');
  }

  const samples = getChannelData(audio, channel);
  if (samples.length === 0) {
    return {
      times: new Float32Array(0),
      energies: new Float32Array(0),
      totalEnergy: 0,
      statistics: { mean: 0, std: 0, max: 0, min: 0 }
    };
  }

  const window =
    windowFunction === 'rectangular' || windowFunction === 'none'
      ? null
      : getWindow(frameSize, windowFunction);
  const times: number[] = [];
  const energies: number[] = [];
  let totalEnergy = 0;
  let maxEnergy = -Infinity;
  let minEnergy = Infinity;

  forEachFrame(
    {
      samples,
      frameSize,
      hopSize,
      sampleRate: audio.sampleRate,
      padEnd: true
    },
    ({ frame, timeSec }) => {
      const frameEnergy = calculateFrameEnergy(frame, window);
      times.push(timeSec);
      energies.push(frameEnergy);
      totalEnergy += frameEnergy;
      maxEnergy = Math.max(maxEnergy, frameEnergy);
      minEnergy = Math.min(minEnergy, frameEnergy);
    }
  );

  const energyArray = new Float32Array(energies);
  const timesArray = new Float32Array(times);
  const frameCount = energyArray.length;
  const mean = frameCount > 0 ? totalEnergy / frameCount : 0;
  let varianceSum = 0;
  for (let i = 0; i < frameCount; i++) {
    const diff = energyArray[i]! - mean;
    varianceSum += diff * diff;
  }
  const std = frameCount > 0 ? Math.sqrt(varianceSum / frameCount) : 0;

  if (normalized && totalEnergy > 1e-10) {
    for (let i = 0; i < energyArray.length; i++) {
      energyArray[i] = energyArray[i]! / totalEnergy;
    }
    return {
      times: timesArray,
      energies: energyArray,
      totalEnergy: 1,
      statistics: {
        mean: mean / totalEnergy,
        std: std / totalEnergy,
        max: maxEnergy / totalEnergy,
        min: minEnergy / totalEnergy
      }
    };
  }

  return {
    times: timesArray,
    energies: energyArray,
    totalEnergy,
    statistics: {
      mean,
      std,
      max: Number.isFinite(maxEnergy) ? maxEnergy : 0,
      min: Number.isFinite(minEnergy) ? minEnergy : 0
    }
  };
}
