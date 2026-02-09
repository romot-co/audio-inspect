import { describe, it, expect } from 'vitest';
import { getEnergy } from '../../src/features/energy.js';
import type { AudioData } from '../../src/types.js';

function createTestAudioData(data: Float32Array, sampleRate = 44100): AudioData {
  return {
    sampleRate,
    channelData: [data],
    duration: data.length / sampleRate,
    numberOfChannels: 1,
    length: data.length
  };
}

function createSineWave(
  frequency: number,
  duration: number,
  sampleRate = 44100,
  amplitude = 1
): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const data = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    data[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
  }

  return data;
}

describe('getEnergy', () => {
  describe('basic functionality', () => {
    it('should calculate energy for sine wave', () => {
      const sineWave = createSineWave(440, 0.1, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const result = getEnergy(audio);

      expect(result.totalEnergy).toBeGreaterThan(0);
      expect(result.times.length).toBeGreaterThan(0);
      expect(result.energies.length).toBe(result.times.length);
      expect(result.statistics.mean).toBeGreaterThan(0);
      expect(result.statistics.max).toBeGreaterThan(0);
      expect(result.statistics.min).toBeGreaterThanOrEqual(0);
    });

    it('should calculate zero energy for silent signal', () => {
      const silence = new Float32Array(1000);
      const audio = createTestAudioData(silence);

      const result = getEnergy(audio);

      expect(result.totalEnergy).toBe(0);
      expect(result.statistics.mean).toBe(0);
      expect(result.statistics.max).toBe(0);
      expect(result.statistics.min).toBe(0);
    });

    it('should handle DC signal', () => {
      const dcSignal = new Float32Array(1000);
      dcSignal.fill(0.5);
      const audio = createTestAudioData(dcSignal);

      const result = getEnergy(audio);

      expect(result.totalEnergy).toBeGreaterThan(0);

      expect(result.statistics.mean).toBeCloseTo(250, 10);
      expect(result.statistics.max).toBeCloseTo(250, 10);
      expect(result.statistics.min).toBeCloseTo(250, 10);
    });
  });

  describe('frame-based analysis', () => {
    it('should use default frame settings', () => {
      const sineWave = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const result = getEnergy(audio);

      expect(result.times.length).toBeGreaterThan(1);
      expect(result.energies.length).toBeGreaterThan(1);
    });

    it('should respect custom frame size', () => {
      const sineWave = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const smallFrames = getEnergy(audio, { frameSize: 512 });
      const largeFrames = getEnergy(audio, { frameSize: 2048 });

      expect(smallFrames.times.length).toBeGreaterThan(largeFrames.times.length);
    });

    it('should respect hop size', () => {
      const sineWave = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const smallHop = getEnergy(audio, { hopSize: 256 });
      const largeHop = getEnergy(audio, { hopSize: 1024 });

      expect(smallHop.times.length).toBeGreaterThan(largeHop.times.length);
    });
  });

  describe('multi-channel support', () => {
    it('should analyze specified channel', () => {
      const channel0 = createSineWave(440, 0.1, 44100, 1.0);
      const channel1 = new Float32Array(channel0.length);
      channel1.fill(0.5);

      const audio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: channel0.length / 44100,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result0 = getEnergy(audio, { channel: 0 });
      const result1 = getEnergy(audio, { channel: 1 });

      expect(result0.totalEnergy).not.toEqual(result1.totalEnergy);

      expect(result1.statistics.mean).toBeGreaterThan(240);
      expect(result1.statistics.mean).toBeLessThan(280);
    });

    it("should average all channels when channel is 'mix'", () => {
      const channel0 = new Float32Array(1000);
      channel0.fill(1.0);
      const channel1 = new Float32Array(1000);
      channel1.fill(0.0);

      const audio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: 1000 / 44100,
        numberOfChannels: 2,
        length: 1000
      };

      const result = getEnergy(audio, { channel: 'mix' });

      expect(result.statistics.mean).toBeCloseTo(250, 10);
    });
  });

  describe('window functions', () => {
    it('should support different window functions', () => {
      const sineWave = createSineWave(440, 0.1, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const rectangular = getEnergy(audio, { windowFunction: 'rectangular' });
      const hann = getEnergy(audio, { windowFunction: 'hann' });
      const hamming = getEnergy(audio, { windowFunction: 'hamming' });

      expect(rectangular.totalEnergy).toBeGreaterThan(0);
      expect(hann.totalEnergy).toBeGreaterThan(0);
      expect(hamming.totalEnergy).toBeGreaterThan(0);

      expect(rectangular.totalEnergy).not.toEqual(hann.totalEnergy);
    });

    it('should keep finite energy with frameSize=1 for taper windows', () => {
      const audio = createTestAudioData(new Float32Array([0.5]));

      const hann = getEnergy(audio, { frameSize: 1, hopSize: 1, windowFunction: 'hann' });
      const hamming = getEnergy(audio, { frameSize: 1, hopSize: 1, windowFunction: 'hamming' });
      const blackman = getEnergy(audio, { frameSize: 1, hopSize: 1, windowFunction: 'blackman' });

      expect(Number.isFinite(hann.totalEnergy)).toBe(true);
      expect(Number.isFinite(hamming.totalEnergy)).toBe(true);
      expect(Number.isFinite(blackman.totalEnergy)).toBe(true);
      expect(hann.totalEnergy).toBeCloseTo(0.25, 6);
      expect(hamming.totalEnergy).toBeCloseTo(0.25, 6);
      expect(blackman.totalEnergy).toBeCloseTo(0.25, 6);
    });
  });

  describe('normalization', () => {
    it('should support normalization option', () => {
      const sineWave = createSineWave(440, 0.1, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const normalized = getEnergy(audio, { normalized: true });
      const unnormalized = getEnergy(audio, { normalized: false });

      expect(normalized.totalEnergy).toBeGreaterThan(0);
      expect(unnormalized.totalEnergy).toBeGreaterThan(0);
      expect(normalized.statistics.max).toBeLessThanOrEqual(1.0);
    });
  });

  describe('different amplitude ranges', () => {
    it('should handle various amplitude levels', () => {
      const amplitudes = [0.1, 0.5, 1.0, 2.0];

      for (const amplitude of amplitudes) {
        const sineWave = createSineWave(440, 0.1, 44100, amplitude);
        const audio = createTestAudioData(sineWave);
        const result = getEnergy(audio);

        expect(result.totalEnergy).toBeGreaterThan(0);
        expect(result.statistics.mean).toBeGreaterThan(0);
      }
    });
  });

  describe('time array validity', () => {
    it('should have monotonically increasing time values', () => {
      const sineWave = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const result = getEnergy(audio);

      for (let i = 1; i < result.times.length; i++) {
        const current = result.times[i];
        const previous = result.times[i - 1];
        if (current !== undefined && previous !== undefined) {
          expect(current).toBeGreaterThan(previous);
        }
      }
    });

    it('should have reasonable time bounds', () => {
      const sineWave = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const result = getEnergy(audio);

      const firstTime = result.times[0];
      const lastTime = result.times[result.times.length - 1];
      if (firstTime !== undefined) {
        expect(firstTime).toBeGreaterThanOrEqual(0);
      }
      if (lastTime !== undefined) {
        expect(lastTime).toBeLessThanOrEqual(audio.duration);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very short audio', () => {
      const shortAudio = createTestAudioData(new Float32Array([1, -1, 0.5]));

      const result = getEnergy(shortAudio);

      expect(result).toBeDefined();
      expect(result.totalEnergy).toBeGreaterThan(0);
      expect(result.times.length).toBeGreaterThan(0);
      expect(result.energies.length).toBe(result.times.length);
    });

    it('should handle single sample', () => {
      const singleSample = createTestAudioData(new Float32Array([0.7]));

      const result = getEnergy(singleSample);

      expect(result.totalEnergy).toBeCloseTo(0.49, 3); // 0.7^2
      expect(result.statistics.mean).toBeCloseTo(0.49, 3);
    });

    it('should handle mixed positive and negative values', () => {
      const mixedSignal = new Float32Array([-1, 0.5, -0.8, 0.2, 1.0]);
      const audio = createTestAudioData(mixedSignal);

      const result = getEnergy(audio);

      expect(result.totalEnergy).toBeGreaterThan(0);
      expect(result.statistics.max).toBeGreaterThan(0);
    });
  });

  describe('statistics validation', () => {
    it('should have consistent statistics', () => {
      const sineWave = createSineWave(440, 0.5, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const result = getEnergy(audio);

      expect(result.statistics.max).toBeGreaterThanOrEqual(result.statistics.mean);
      expect(result.statistics.mean).toBeGreaterThanOrEqual(result.statistics.min);
      expect(result.statistics.std).toBeGreaterThanOrEqual(0);
    });

    it('should have zero standard deviation for constant energy', () => {
      const dcSignal = new Float32Array(2000);
      dcSignal.fill(0.5);
      const audio = createTestAudioData(dcSignal);

      const result = getEnergy(audio, { frameSize: 100, hopSize: 100 });

      expect(result.statistics.std).toBeCloseTo(0, 3);
    });
  });
});
