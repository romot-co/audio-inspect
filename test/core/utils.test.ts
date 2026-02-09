import { describe, it, expect } from 'vitest';
import {
  getChannelData,
  safeArrayAccess,
  isPowerOfTwo,
  nextPowerOfTwo
} from '../../src/core/utils.js';
import type { AudioData } from '../../src/types.js';

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

    it("should compute average for channel 'mix'", () => {
      const channel0 = new Float32Array([1, 2, 3]);
      const channel1 = new Float32Array([2, 4, 6]);
      const audio = createTestAudioData({
        channelData: [channel0, channel1],
        numberOfChannels: 2,
        length: 3
      });

      const result = getChannelData(audio, 'mix');

      expect(result[0]).toBe(1.5); // (1+2)/2
      expect(result[1]).toBe(3); // (2+4)/2
      expect(result[2]).toBe(4.5); // (3+6)/2
    });

    it('should handle missing channel data when computing average', () => {
      const channel0 = new Float32Array([1, 2, 3]);
      const audio = createTestAudioData({
        channelData: [channel0, undefined as unknown as Float32Array],
        numberOfChannels: 2,
        length: 3
      });

      expect(() => getChannelData(audio, 'mix')).toThrow();
    });

    it('should throw error for invalid channel number', () => {
      const audio = createTestAudioData({
        channelData: [new Float32Array([1, 2, 3])],
        numberOfChannels: 1,
        length: 3
      });

      expect(() => getChannelData(audio, 1)).toThrow('Invalid channel number: 1');
      expect(() => getChannelData(audio, -2)).toThrow('Invalid channel number: -2');
    });

    it('should throw error for missing channel data', () => {
      const audio = createTestAudioData({
        channelData: [undefined as unknown as Float32Array],
        numberOfChannels: 1,
        length: 3
      });

      expect(() => getChannelData(audio, 0)).toThrow('Channel 0 data does not exist');
    });

    it('should reject channel selector all for scalar access', () => {
      const audio = createTestAudioData({
        channelData: [new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])],
        numberOfChannels: 2,
        length: 3
      });

      expect(() => getChannelData(audio, 'all')).toThrow('not supported for scalar results');
    });

    it('should reject multi-channel selector arrays for scalar access', () => {
      const audio = createTestAudioData({
        channelData: [new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])],
        numberOfChannels: 2,
        length: 3
      });

      expect(() => getChannelData(audio, [0, 1])).toThrow('not supported for scalar results');
    });

    it('should extract channel data correctly', () => {
      const audioData: AudioData = {
        sampleRate: 44100,
        channelData: [new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])],
        duration: 1,
        numberOfChannels: 2,
        length: 3
      };

      const leftChannel = getChannelData(audioData, 0);
      const rightChannel = getChannelData(audioData, 1);

      expect(leftChannel).toEqual(new Float32Array([1, 2, 3]));
      expect(rightChannel).toEqual(new Float32Array([4, 5, 6]));
    });

    it('should handle invalid channel index', () => {
      const audioData: AudioData = {
        sampleRate: 44100,
        channelData: [new Float32Array([1, 2, 3])],
        duration: 1,
        numberOfChannels: 1,
        length: 3
      };

      expect(() => getChannelData(audioData, 1)).toThrow('Invalid channel number');
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
    it('should identify powers of two correctly', () => {
      expect(isPowerOfTwo(1)).toBe(true);
      expect(isPowerOfTwo(2)).toBe(true);
      expect(isPowerOfTwo(4)).toBe(true);
      expect(isPowerOfTwo(8)).toBe(true);
      expect(isPowerOfTwo(1024)).toBe(true);

      expect(isPowerOfTwo(3)).toBe(false);
      expect(isPowerOfTwo(5)).toBe(false);
      expect(isPowerOfTwo(7)).toBe(false);
      expect(isPowerOfTwo(15)).toBe(false);

      expect(isPowerOfTwo(null as unknown as number)).toBe(false);
      expect(isPowerOfTwo('test' as unknown as number)).toBe(false);
    });
  });

  describe('nextPowerOfTwo', () => {
    it('should find next power of two correctly', () => {
      expect(nextPowerOfTwo(1)).toBe(1);
      expect(nextPowerOfTwo(2)).toBe(2);
      expect(nextPowerOfTwo(3)).toBe(4);
      expect(nextPowerOfTwo(5)).toBe(8);
      expect(nextPowerOfTwo(9)).toBe(16);
      expect(nextPowerOfTwo(1000)).toBe(1024);
    });

    it('should handle edge cases', () => {
      expect(nextPowerOfTwo(0)).toBe(1);
      expect(nextPowerOfTwo(-5)).toBe(1);
      expect(nextPowerOfTwo(NaN as unknown as number)).toBe(1);
      expect(nextPowerOfTwo(Infinity as unknown as number)).toBe(1);
    });
  });
});
