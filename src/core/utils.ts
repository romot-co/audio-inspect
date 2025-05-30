import { AudioData, AudioInspectError } from '../types.js';

/**
 * Safely get channel data common function
 * @param audio - AudioData object
 * @param channel - Channel number (-1 for average of all channels)
 * @returns Data of the specified channel
 * @throws AudioInspectError if channel is invalid
 */
export function getChannelData(audio: AudioData, channel: number): Float32Array {
  if (channel === -1) {
    // Calculate average of all channels
    const averageData = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        const channelData = audio.channelData[ch];
        if (!channelData) {
          throw new AudioInspectError('INVALID_INPUT', `Channel ${ch} data does not exist`);
        }
        if (i < channelData.length) {
          const sample = channelData[i];
          if (sample !== undefined) {
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
      'INVALID_INPUT',
      `Invalid channel number: ${channel}. Valid range is 0-${audio.numberOfChannels - 1} or -1 (average)`
    );
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
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && Number.isInteger(n) && (n & (n - 1)) === 0;
}

/**
 * Calculate the next power of two
 */
export function nextPowerOfTwo(n: number): number {
  if (!isValidSample(n) || n <= 0) return 1;
  if (isPowerOfTwo(n)) return n;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Type-safe array access
 */
export function safeArrayAccess<T>(array: ArrayLike<T>, index: number, defaultValue: T): T {
  if (index >= 0 && index < array.length) {
    return array[index] ?? defaultValue;
  }
  return defaultValue;
}

/**
 * Validate number validity
 */
export function isValidSample(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Safe retrieval of sample values
 */
export function ensureValidSample(
  value: number | undefined | null,
  defaultValue: number = 0
): number {
  return isValidSample(value) ? value : defaultValue;
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
export function amplitudeToDecibels(amplitude: number, reference: number = 1.0): number {
  const MIN_AMPLITUDE_FOR_DB = 1e-10; // -200 dBFS
  const SILENCE_DB = -Infinity;

  if (amplitude <= 0 || reference <= 0) {
    return SILENCE_DB;
  }

  const ratio = amplitude / reference;
  return ratio > MIN_AMPLITUDE_FOR_DB ? 20 * Math.log10(ratio) : SILENCE_DB;
}

/**
 * Convert dB to amplitude
 */
export function decibelsToAmplitude(db: number, reference: number = 1.0): number {
  if (!isFinite(db)) return 0;
  return reference * Math.pow(10, db / 20);
}
