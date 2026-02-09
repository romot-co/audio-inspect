import { AudioInspectError, type AudioData, type ChannelSelector } from '../types.js';

export function getPerformanceNow(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  if (typeof process !== 'undefined' && process.hrtime) {
    const [seconds, nanoseconds] = process.hrtime();
    return seconds * 1000 + nanoseconds / 1000000;
  }
  return Date.now();
}

function isChannelArray(value: ChannelSelector): value is readonly number[] {
  return Array.isArray(value);
}

export function getChannelData(audio: AudioData, channel: ChannelSelector = 'mix'): Float32Array {
  if (audio.numberOfChannels <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'No channels available');
  }

  const allChannels = Array.from({ length: audio.numberOfChannels }, (_, idx) => idx);
  let selectedChannels: number[];

  if (channel === 'mix') {
    selectedChannels = allChannels;
  } else if (channel === 'all') {
    throw new AudioInspectError(
      'INVALID_INPUT',
      'Channel selector "all" is not supported for scalar results; use "mix" or a single channel index'
    );
  } else if (isChannelArray(channel)) {
    if (channel.length === 0) {
      throw new AudioInspectError('INVALID_INPUT', 'Channel selection array cannot be empty');
    }
    if (channel.length > 1) {
      throw new AudioInspectError(
        'INVALID_INPUT',
        'Multi-channel selector arrays are not supported for scalar results; use "mix" or a single channel index'
      );
    }
    selectedChannels = channel.slice();
  } else if (typeof channel === 'number') {
    if (!Number.isInteger(channel)) {
      throw new AudioInspectError('INVALID_INPUT', `Invalid channel number: ${channel}`);
    }
    selectedChannels = [channel];
  } else {
    throw new AudioInspectError('INVALID_INPUT', `Invalid channel selector: ${String(channel)}`);
  }

  for (const ch of selectedChannels) {
    if (ch < 0 || ch >= audio.numberOfChannels) {
      throw new AudioInspectError('INVALID_INPUT', `Invalid channel number: ${ch}`);
    }
    if (!audio.channelData[ch]) {
      throw new AudioInspectError('INVALID_INPUT', `Channel ${ch} data does not exist`);
    }
  }

  if (selectedChannels.length === 1) {
    const ch = selectedChannels[0]!;
    return audio.channelData[ch]!;
  }

  const averageData = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i++) {
    let sum = 0;
    for (const ch of selectedChannels) {
      const channelData = audio.channelData[ch];
      if (channelData && i < channelData.length) {
        sum += channelData[i]!;
      }
    }
    averageData[i] = sum / selectedChannels.length;
  }

  return averageData;
}

export function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

export function nextPowerOfTwo(value: number): number {
  if (!Number.isFinite(value) || value <= 1) {
    return 1;
  }
  if (isPowerOfTwo(value)) {
    return value;
  }

  let power = 1;
  while (power < value && power < Number.MAX_SAFE_INTEGER) {
    power *= 2;
  }
  return power;
}

export function safeArrayAccess<T>(arr: T[], index: number, defaultValue: T): T {
  if (index < 0 || index >= arr.length) {
    return defaultValue;
  }
  return arr[index] ?? defaultValue;
}

export function ensureFloat32Array(
  data: Float32Array | undefined | null,
  length: number
): Float32Array {
  if (data instanceof Float32Array && data.length === length) {
    return data;
  }
  return new Float32Array(length);
}
