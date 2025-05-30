import { AudioData, AudioInspectError } from '../types.js';

/**
 * Safely get channel data common function
 * @param audio - AudioData object
 * @param channel - Channel number (-1 for average of all channels)
 * @returns Data of the specified channel
 * @throws AudioInspectError if channel is invalid
 */
export function getChannelData(audio: AudioData, channel = 0): Float32Array {
  if (channel === -1) {
    // Calculate average across all channels
    if (audio.numberOfChannels === 0) {
      throw new AudioInspectError('INVALID_INPUT', 'No channels available');
    }

    // Check if any channel is undefined
    for (let ch = 0; ch < audio.numberOfChannels; ch++) {
      if (!audio.channelData[ch]) {
        throw new AudioInspectError(
          'INVALID_INPUT',
          `Channel ${ch} data does not exist for averaging`
        );
      }
    }

    const averageData = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        const channelData = audio.channelData[ch];
        if (channelData && i < channelData.length) {
          sum += channelData[i] ?? 0;
        }
      }
      averageData[i] = sum / audio.numberOfChannels;
    }
    return averageData;
  }

  if (channel < -1 || channel >= audio.numberOfChannels) {
    throw new AudioInspectError('INVALID_INPUT', `Invalid channel number: ${channel}`);
  }

  const channelData = audio.channelData[channel];
  if (!channelData) {
    throw new AudioInspectError('INVALID_INPUT', `Channel ${channel} data does not exist`);
  }

  return channelData;
}

/**
 * Check if a number is a power of two
 */
export function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

/**
 * Calculate the next power of two
 */
export function nextPowerOfTwo(value: number): number {
  if (value <= 0 || !isFinite(value) || isNaN(value)) return 1;
  if (isPowerOfTwo(value)) return value;

  let power = 1;
  while (power < value && power < Number.MAX_SAFE_INTEGER) {
    power *= 2;
  }
  return power;
}

/**
 * Type-safe array access
 */
export function safeArrayAccess<T>(arr: T[], index: number, defaultValue: T): T {
  if (index < 0 || index >= arr.length) {
    return defaultValue;
  }
  return arr[index] ?? defaultValue;
}

/**
 * Validate number validity
 */
export function isValidSample(sample: number): boolean {
  // Check for null/undefined values that are cast to number
  if (sample == null) return false;
  return !isNaN(sample) && isFinite(sample);
}

/**
 * Safe retrieval of sample values
 */
export function ensureValidSample(sample: number): number {
  // Check for null/undefined values that are cast to number
  if (sample == null || isNaN(sample) || !isFinite(sample)) {
    return 0;
  }
  return sample;
}

/**
 * Safe allocation of Float32Array
 */
export function ensureFloat32Array(
  data: Float32Array | undefined | null,
  length: number
): Float32Array {
  if (data instanceof Float32Array && data.length === length) {
    return data;
  }
  return new Float32Array(length);
}

/**
 * Convert amplitude to dB
 */
export function amplitudeToDecibels(amplitude: number, reference = 1.0): number {
  if (amplitude <= 0 || reference <= 0) return -Infinity;
  return 20 * Math.log10(amplitude / reference);
}

/**
 * Convert dB to amplitude
 */
export function decibelsToAmplitude(decibels: number, reference = 1.0): number {
  if (decibels === -Infinity) return 0;
  return reference * Math.pow(10, decibels / 20);
}

/**
 * ステレオオーディオをモノラルに変換
 */
export function toMono(audio: AudioData): AudioData {
  if (audio.numberOfChannels === 1) {
    return audio;
  }

  const monoData = new Float32Array(audio.length);
  const channelCount = audio.numberOfChannels;

  for (let i = 0; i < audio.length; i++) {
    let sum = 0;
    for (let ch = 0; ch < channelCount; ch++) {
      sum += audio.channelData[ch]?.[i] ?? 0;
    }
    monoData[i] = sum / channelCount;
  }

  return {
    ...audio,
    channelData: [monoData],
    numberOfChannels: 1
  };
}

/**
 * オーディオデータを時間範囲でスライス
 */
export function sliceAudio(audio: AudioData, startTime: number, endTime: number): AudioData {
  if (startTime < 0 || endTime < 0 || startTime >= endTime) {
    throw new AudioInspectError('INVALID_INPUT', '無効な時間範囲が指定されました', {
      startTime,
      endTime
    });
  }

  if (endTime > audio.duration) {
    throw new AudioInspectError('INVALID_INPUT', '終了時間が音声の長さを超えています', {
      endTime,
      duration: audio.duration
    });
  }

  const startSample = Math.floor(startTime * audio.sampleRate);
  const endSample = Math.min(Math.floor(endTime * audio.sampleRate), audio.length);
  const length = endSample - startSample;

  if (length <= 0) {
    throw new AudioInspectError('INSUFFICIENT_DATA', 'スライス範囲が小さすぎます', {
      startSample,
      endSample,
      length
    });
  }

  const slicedChannels = audio.channelData.map((channel) => channel.slice(startSample, endSample));

  return {
    ...audio,
    channelData: slicedChannels,
    duration: endTime - startTime,
    length
  };
}

/**
 * オーディオデータを正規化（-1〜1の範囲に）
 */
export function normalizeAudio(audio: AudioData): AudioData {
  let maxAmplitude = 0;

  // 最大振幅を検出
  for (const channel of audio.channelData) {
    for (const sample of channel) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
    }
  }

  if (maxAmplitude === 0 || maxAmplitude === 1) {
    return audio;
  }

  // 正規化
  const normalizedChannels = audio.channelData.map((channel) => {
    const normalized = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      normalized[i] = (channel[i] ?? 0) / maxAmplitude;
    }
    return normalized;
  });

  return {
    ...audio,
    channelData: normalizedChannels
  };
}
