import { describe, it, expect } from 'vitest';
import {
  getChannelData,
  ensureValidSample,
  isValidSample,
  amplitudeToDecibels,
  safeArrayAccess,
  isPowerOfTwo,
  nextPowerOfTwo
} from '../../src/core/utils.js';
import type { AudioData } from '../../src/types.js';

// テスト用のAudioDataを作成するヘルパー
function createTestAudioData(options: Partial<AudioData> = {}): AudioData {
  const sampleRate = options.sampleRate ?? 44100;
  const duration = options.duration ?? 1;
  const length = options.length ?? sampleRate * duration;
  const channelData = options.channelData ?? [new Float32Array(length)];

  return {
    sampleRate,
    channelData,
    duration,
    numberOfChannels: channelData.length,
    length,
    ...options
  };
}

describe('utils', () => {
  describe('getChannelData', () => {
    it('should return specified channel data', () => {
      const channel0 = new Float32Array([1, 2, 3]);
      const channel1 = new Float32Array([4, 5, 6]);
      const audio = createTestAudioData({
        channelData: [channel0, channel1],
        numberOfChannels: 2,
        length: 3
      });

      const result0 = getChannelData(audio, 0);
      const result1 = getChannelData(audio, 1);

      expect(result0).toBe(channel0);
      expect(result1).toBe(channel1);
    });

    it('should compute average for channel -1', () => {
      const channel0 = new Float32Array([1, 2, 3]);
      const channel1 = new Float32Array([2, 4, 6]);
      const audio = createTestAudioData({
        channelData: [channel0, channel1],
        numberOfChannels: 2,
        length: 3
      });

      const result = getChannelData(audio, -1);

      expect(result[0]).toBe(1.5); // (1+2)/2
      expect(result[1]).toBe(3);   // (2+4)/2
      expect(result[2]).toBe(4.5); // (3+6)/2
    });

    it('should handle missing channel data when computing average', () => {
      const channel0 = new Float32Array([1, 2, 3]);
      const audio = createTestAudioData({
        channelData: [channel0, undefined as any],
        numberOfChannels: 2,
        length: 3
      });

      // channel -1での平均計算時はundefinedチャンネルを無視するかエラーになる
      expect(() => getChannelData(audio, -1)).toThrow();
    });

    it('should throw error for invalid channel number', () => {
      const audio = createTestAudioData({
        channelData: [new Float32Array([1, 2, 3])],
        numberOfChannels: 1,
        length: 3
      });

      expect(() => getChannelData(audio, 1)).toThrow('無効なチャンネル番号: 1');
      expect(() => getChannelData(audio, -2)).toThrow('無効なチャンネル番号: -2');
    });

    it('should throw error for missing channel data', () => {
      const audio = createTestAudioData({
        channelData: [undefined as any],
        numberOfChannels: 1,
        length: 3
      });

      expect(() => getChannelData(audio, 0)).toThrow('チャンネル 0 のデータが存在しません');
    });
  });

  describe('ensureValidSample', () => {
    it('should return valid numbers as-is', () => {
      expect(ensureValidSample(1.0)).toBe(1.0);
      expect(ensureValidSample(-0.5)).toBe(-0.5);
      expect(ensureValidSample(0)).toBe(0);
      expect(ensureValidSample(0.123456)).toBe(0.123456);
    });

    it('should return 0 for invalid values', () => {
      expect(ensureValidSample(NaN)).toBe(0);
      expect(ensureValidSample(Infinity)).toBe(0);
      expect(ensureValidSample(-Infinity)).toBe(0);
      expect(ensureValidSample(undefined as any)).toBe(0);
      expect(ensureValidSample(null as any)).toBe(0);
    });
  });

  describe('isValidSample', () => {
    it('should return true for valid numbers', () => {
      expect(isValidSample(1.0)).toBe(true);
      expect(isValidSample(-0.5)).toBe(true);
      expect(isValidSample(0)).toBe(true);
      expect(isValidSample(0.123456)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isValidSample(NaN)).toBe(false);
      expect(isValidSample(Infinity)).toBe(false);
      expect(isValidSample(-Infinity)).toBe(false);
      expect(isValidSample(undefined as any)).toBe(false);
      expect(isValidSample(null as any)).toBe(false);
    });
  });

  describe('amplitudeToDecibels', () => {
    it('should convert amplitude to decibels', () => {
      expect(amplitudeToDecibels(1.0, 1.0)).toBe(0);
      expect(amplitudeToDecibels(0.5, 1.0)).toBeCloseTo(-6.02, 1); // 20*log10(0.5)
      expect(amplitudeToDecibels(2.0, 1.0)).toBeCloseTo(6.02, 1);  // 20*log10(2)
    });

    it('should handle different reference values', () => {
      expect(amplitudeToDecibels(1.0, 0.5)).toBeCloseTo(6.02, 1);  // 20*log10(1/0.5)
      expect(amplitudeToDecibels(0.5, 0.5)).toBe(0);
    });

    it('should return -Infinity for zero amplitude', () => {
      expect(amplitudeToDecibels(0, 1.0)).toBe(-Infinity);
    });

    it('should return -Infinity for negative values', () => {
      expect(amplitudeToDecibels(-0.5, 1.0)).toBe(-Infinity);
      expect(amplitudeToDecibels(-1.0, 1.0)).toBe(-Infinity);
    });

    it('should return -Infinity for zero or negative reference', () => {
      expect(amplitudeToDecibels(1.0, 0)).toBe(-Infinity);
      expect(amplitudeToDecibels(0.5, 0)).toBe(-Infinity);
      expect(amplitudeToDecibels(1.0, -1.0)).toBe(-Infinity);
    });
  });

  describe('safeArrayAccess', () => {
    it('should return array element for valid indices', () => {
      const array = [10, 20, 30];
      expect(safeArrayAccess(array, 0, -1)).toBe(10);
      expect(safeArrayAccess(array, 1, -1)).toBe(20);
      expect(safeArrayAccess(array, 2, -1)).toBe(30);
    });

    it('should return default value for out-of-bounds indices', () => {
      const array = [10, 20, 30];
      expect(safeArrayAccess(array, -1, 99)).toBe(99);
      expect(safeArrayAccess(array, 3, 99)).toBe(99);
      expect(safeArrayAccess(array, 100, 99)).toBe(99);
    });

    it('should return default value for undefined elements', () => {
      const array = [10, undefined, 30];
      expect(safeArrayAccess(array, 1, 99)).toBe(99);
    });

    it('should work with different data types', () => {
      const stringArray = ['a', 'b', 'c'];
      expect(safeArrayAccess(stringArray, 1, 'default')).toBe('b');
      expect(safeArrayAccess(stringArray, 5, 'default')).toBe('default');

      const objectArray = [{ id: 1 }, { id: 2 }];
      const defaultObj = { id: -1 };
      expect(safeArrayAccess(objectArray, 0, defaultObj)).toEqual({ id: 1 });
      expect(safeArrayAccess(objectArray, 5, defaultObj)).toEqual(defaultObj);
    });
  });

  describe('isPowerOfTwo', () => {
    it('should return true for powers of two', () => {
      expect(isPowerOfTwo(1)).toBe(true);    // 2^0
      expect(isPowerOfTwo(2)).toBe(true);    // 2^1
      expect(isPowerOfTwo(4)).toBe(true);    // 2^2
      expect(isPowerOfTwo(8)).toBe(true);    // 2^3
      expect(isPowerOfTwo(16)).toBe(true);   // 2^4
      expect(isPowerOfTwo(1024)).toBe(true); // 2^10
      expect(isPowerOfTwo(2048)).toBe(true); // 2^11
    });

    it('should return false for non-powers of two', () => {
      expect(isPowerOfTwo(0)).toBe(false);
      expect(isPowerOfTwo(3)).toBe(false);
      expect(isPowerOfTwo(5)).toBe(false);
      expect(isPowerOfTwo(6)).toBe(false);
      expect(isPowerOfTwo(7)).toBe(false);
      expect(isPowerOfTwo(1000)).toBe(false);
      expect(isPowerOfTwo(1025)).toBe(false);
    });

    it('should return false for negative numbers', () => {
      expect(isPowerOfTwo(-1)).toBe(false);
      expect(isPowerOfTwo(-2)).toBe(false);
      expect(isPowerOfTwo(-4)).toBe(false);
    });
  });

  describe('nextPowerOfTwo', () => {
    it('should return the same number if already a power of two', () => {
      expect(nextPowerOfTwo(1)).toBe(1);
      expect(nextPowerOfTwo(2)).toBe(2);
      expect(nextPowerOfTwo(4)).toBe(4);
      expect(nextPowerOfTwo(8)).toBe(8);
      expect(nextPowerOfTwo(1024)).toBe(1024);
    });

    it('should return the next power of two for non-powers', () => {
      expect(nextPowerOfTwo(3)).toBe(4);
      expect(nextPowerOfTwo(5)).toBe(8);
      expect(nextPowerOfTwo(6)).toBe(8);
      expect(nextPowerOfTwo(7)).toBe(8);
      expect(nextPowerOfTwo(9)).toBe(16);
      expect(nextPowerOfTwo(1000)).toBe(1024);
      expect(nextPowerOfTwo(1025)).toBe(2048);
    });

    it('should handle edge cases', () => {
      expect(nextPowerOfTwo(0)).toBe(1);
      expect(nextPowerOfTwo(-1)).toBe(1);
      expect(nextPowerOfTwo(-5)).toBe(1);
    });

    it('should handle large numbers', () => {
      expect(nextPowerOfTwo(65535)).toBe(65536);
      expect(nextPowerOfTwo(65536)).toBe(65536);
      expect(nextPowerOfTwo(65537)).toBe(131072);
    });
  });
}); 