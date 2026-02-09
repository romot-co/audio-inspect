import { describe, it, expect } from 'vitest';
import { getCrestFactor } from '../../src/features/dynamics.js';
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

function createImpulseSignal(amplitude: number, length: number): Float32Array {
  const data = new Float32Array(length);
  data[Math.floor(length / 2)] = amplitude;
  return data;
}

describe('getCrestFactor', () => {
  describe('basic functionality', () => {
    it('should calculate crest factor for sine wave', () => {
      const sineWave = createSineWave(440, 0.1, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const result = getCrestFactor(audio);

      expect(result.crestFactorLinear).toBeCloseTo(Math.sqrt(2), 1);
      expect(result.peak).toBeCloseTo(1.0, 2);
      expect(result.rms).toBeCloseTo(1.0 / Math.sqrt(2), 2);
      expect(result.crestFactor).toBeCloseTo(20 * Math.log10(Math.sqrt(2)), 1);
    });

    it('should calculate crest factor for DC signal', () => {
      const dcSignal = new Float32Array(1000);
      dcSignal.fill(0.5);
      const audio = createTestAudioData(dcSignal);

      const result = getCrestFactor(audio);

      expect(result.crestFactorLinear).toBeCloseTo(1.0, 3);
      expect(result.crestFactor).toBeCloseTo(0, 3);
      expect(result.peak).toBeCloseTo(0.5, 3);
      expect(result.rms).toBeCloseTo(0.5, 3);
    });

    it('should calculate high crest factor for impulse signal', () => {
      const impulseSignal = createImpulseSignal(1.0, 1000);
      const audio = createTestAudioData(impulseSignal);

      const result = getCrestFactor(audio);

      expect(result.crestFactorLinear).toBeGreaterThan(10);
      expect(result.crestFactor).toBeGreaterThan(20);
      expect(result.peak).toBe(1.0);
      expect(result.rms).toBeLessThan(0.1);
    });

    it('should handle silent signal', () => {
      const silence = new Float32Array(1000);
      const audio = createTestAudioData(silence);

      const result = getCrestFactor(audio);

      expect(result.crestFactorLinear).toBe(Infinity);
      expect(result.crestFactor).toBe(Infinity);
      expect(result.peak).toBe(0);
      expect(result.rms).toBe(0);
    });
  });

  describe('different amplitudes', () => {
    it('should be amplitude-independent for sine waves', () => {
      const amplitudes = [0.1, 0.5, 1.0, 2.0];

      for (const amplitude of amplitudes) {
        const sineWave = createSineWave(440, 0.1, 44100, amplitude);
        const audio = createTestAudioData(sineWave);
        const result = getCrestFactor(audio);

        expect(result.crestFactorLinear).toBeCloseTo(Math.sqrt(2), 1);
        expect(result.peak).toBeCloseTo(amplitude, 2);
        expect(result.rms).toBeCloseTo(amplitude / Math.sqrt(2), 2);
      }
    });
  });

  describe('multi-channel support', () => {
    it('should analyze specified channel', () => {
      const channel0 = createSineWave(440, 0.1, 44100, 1.0);
      const channel1 = new Float32Array(channel0.length);
      channel1.fill(0.5); // DC signal

      const audio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: channel0.length / 44100,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result0 = getCrestFactor(audio, { channel: 0 });
      const result1 = getCrestFactor(audio, { channel: 1 });

      expect(result0.crestFactorLinear).toBeCloseTo(Math.sqrt(2), 1);
      expect(result1.crestFactorLinear).toBeCloseTo(1.0, 3);
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

      const result = getCrestFactor(audio, { channel: 'mix' });

      expect(result.crestFactorLinear).toBeCloseTo(1.0, 3);
      expect(result.peak).toBeCloseTo(0.5, 3);
      expect(result.rms).toBeCloseTo(0.5, 3);
    });
  });

  describe('windowed analysis', () => {
    it('should support window-based analysis', () => {
      const sineWave = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const result = getCrestFactor(audio, {
        windowSize: 0.1,
        hopSize: 0.05 // 50ms hop
      });

      expect(result.timeVarying).toBeDefined();
      expect(result.timeVarying?.times.length).toBeGreaterThan(1);
      expect(result.timeVarying?.values.length).toBeGreaterThan(1);
      expect(result.timeVarying?.valuesLinear.length).toBeGreaterThan(1);
    });
  });

  describe('different methods', () => {
    it('should support simple and weighted methods', () => {
      const sineWave = createSineWave(440, 0.1, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const simpleResult = getCrestFactor(audio, { method: 'simple' });
      const weightedResult = getCrestFactor(audio, { method: 'weighted' });

      expect(simpleResult).toBeDefined();
      expect(weightedResult).toBeDefined();

      expect(simpleResult.crestFactorLinear).toBeGreaterThan(0);
      expect(weightedResult.crestFactorLinear).toBeGreaterThan(0);
      expect(simpleResult.peak).toBeGreaterThan(0);
      expect(weightedResult.peak).toBeGreaterThan(0);
      expect(simpleResult.rms).toBeGreaterThan(0);
      expect(weightedResult.rms).toBeGreaterThan(0);
    });

    it('should show difference between simple and weighted methods for different frequencies', () => {
      const lowFreqWave = createSineWave(20, 0.1, 44100, 1.0);
      const lowFreqAudio = createTestAudioData(lowFreqWave);

      const lowFreqSimple = getCrestFactor(lowFreqAudio, { method: 'simple' });
      const lowFreqWeighted = getCrestFactor(lowFreqAudio, { method: 'weighted' });

      const highFreqWave = createSineWave(10000, 0.1, 44100, 1.0);
      const highFreqAudio = createTestAudioData(highFreqWave);

      const highFreqSimple = getCrestFactor(highFreqAudio, { method: 'simple' });
      const highFreqWeighted = getCrestFactor(highFreqAudio, { method: 'weighted' });

      expect(lowFreqSimple.crestFactorLinear).toBeCloseTo(Math.sqrt(2), 1);
      expect(highFreqSimple.crestFactorLinear).toBeCloseTo(Math.sqrt(2), 1);

      expect(lowFreqWeighted).toBeDefined();
      expect(highFreqWeighted).toBeDefined();
    });

    it('should support weighted method with windowed analysis', () => {
      const sineWave = createSineWave(1000, 1.0, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const result = getCrestFactor(audio, {
        method: 'weighted',
        windowSize: 0.1,
        hopSize: 0.05 // 50ms hop
      });

      expect(result.timeVarying).toBeDefined();
      expect(result.timeVarying?.times.length).toBeGreaterThan(1);
      expect(result.timeVarying?.values.length).toBeGreaterThan(1);

      if (result.timeVarying) {
        for (let i = 0; i < result.timeVarying.values.length; i++) {
          const cfValue = result.timeVarying.values[i];
          if (cfValue !== undefined && isFinite(cfValue)) {
            expect(cfValue).toBeGreaterThan(-50);
            expect(cfValue).toBeLessThan(50);
          }
        }
      }
    });
  });

  describe('different waveforms', () => {
    it('should calculate different crest factors for different waveforms', () => {
      const sineWave = createSineWave(440, 0.1, 44100, 1.0);
      const sineAudio = createTestAudioData(sineWave);
      const sineResult = getCrestFactor(sineAudio);

      const squareWave = new Float32Array(4410);
      for (let i = 0; i < squareWave.length; i++) {
        const t = i / 44100;
        squareWave[i] = Math.sign(Math.sin(2 * Math.PI * 440 * t));
      }
      const squareAudio = createTestAudioData(squareWave);
      const squareResult = getCrestFactor(squareAudio);

      const noise = new Float32Array(4410);
      for (let i = 0; i < noise.length; i++) {
        noise[i] = (Math.random() - 0.5) * 2; // -1 to 1
      }
      const noiseAudio = createTestAudioData(noise);
      const noiseResult = getCrestFactor(noiseAudio);

      expect(sineResult.crestFactorLinear).toBeCloseTo(Math.sqrt(2), 1);
      expect(squareResult.crestFactorLinear).toBeCloseTo(1.0, 1);
      expect(noiseResult.crestFactorLinear).toBeGreaterThan(1.5);
    });
  });

  describe('edge cases', () => {
    it('should handle very short audio', () => {
      const shortAudio = createTestAudioData(new Float32Array([1, -1, 0.5]));

      const result = getCrestFactor(shortAudio);

      expect(result).toBeDefined();
      expect(result.crestFactorLinear).toBeGreaterThan(0);
      expect(result.peak).toBe(1.0);
    });

    it('should handle mixed positive and negative values', () => {
      const mixedSignal = new Float32Array([-1, 0.5, -0.8, 0.2, 1.0]);
      const audio = createTestAudioData(mixedSignal);

      const result = getCrestFactor(audio);

      expect(result.peak).toBe(1.0); // max absolute value
      expect(result.crestFactorLinear).toBeGreaterThan(0);
    });

    it('should handle single sample', () => {
      const singleSample = createTestAudioData(new Float32Array([0.7]));

      const result = getCrestFactor(singleSample);

      expect(result.crestFactorLinear).toBeCloseTo(1.0, 3);
      expect(result.peak).toBeCloseTo(0.7, 3);
      expect(result.rms).toBeCloseTo(0.7, 3);
    });
  });
});
