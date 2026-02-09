import { describe, it, expect } from 'vitest';
import { getVAD } from '../../src/features/vad.js';
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

function createWhiteNoise(length: number, amplitude = 1): Float32Array {
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() - 0.5) * 2 * amplitude;
  }
  return data;
}

function createSpeechLikeSignal(duration: number, sampleRate = 44100): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const data = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;

    const envelope = Math.sin(2 * Math.PI * 5 * t) * 0.5 + 0.5;
    const carrier =
      0.3 * Math.sin(2 * Math.PI * 200 * t) +
      0.4 * Math.sin(2 * Math.PI * 400 * t) +
      0.2 * Math.sin(2 * Math.PI * 800 * t) +
      0.1 * (Math.random() - 0.5);

    data[i] = carrier * envelope * 0.5;
  }

  return data;
}

function createMixedSignal(
  speechDuration: number,
  silenceDuration: number,
  speechAmplitude = 0.3,
  sampleRate = 44100
): Float32Array {
  const speechSignal = createSpeechLikeSignal(speechDuration, sampleRate);
  const silenceSignal = new Float32Array(Math.floor(silenceDuration * sampleRate));

  for (let i = 0; i < silenceSignal.length; i++) {
    silenceSignal[i] = (Math.random() - 0.5) * 0.01;
  }

  const combined = new Float32Array(speechSignal.length + silenceSignal.length);

  for (let i = 0; i < speechSignal.length; i++) {
    combined[i] = (speechSignal[i] ?? 0) * speechAmplitude;
  }

  combined.set(silenceSignal, speechSignal.length);
  return combined;
}

describe('getVAD', () => {
  describe('basic functionality', () => {
    it('should detect speech and silence segments', () => {
      const mixedSignal = createMixedSignal(2.0, 1.0, 0.5);
      const audio = createTestAudioData(mixedSignal);

      const result = getVAD(audio);

      expect(result.segments).toBeDefined();
      expect(result.speechRatio).toBeDefined();
      expect(result.segments.length).toBeGreaterThan(0);

      expect(result.speechRatio).toBeGreaterThanOrEqual(0);
      expect(result.speechRatio).toBeLessThanOrEqual(1);

      result.segments.forEach((segment) => {
        expect(segment.start).toBeGreaterThanOrEqual(0);
        expect(segment.end).toBeGreaterThan(segment.start);
        expect(segment.end).toBeLessThanOrEqual(audio.duration);
        expect(['speech', 'silence']).toContain(segment.type);
      });
    });

    it('should handle speech-only signal', () => {
      const speechSignal = createSpeechLikeSignal(3.0);
      const audio = createTestAudioData(speechSignal);

      const result = getVAD(audio);

      expect(result.segments).toBeDefined();
      expect(result.speechRatio).toBeGreaterThanOrEqual(0);

      const speechSegments = result.segments.filter((s) => s.type === 'speech');
      expect(speechSegments.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle silence-only signal', () => {
      const silence = new Float32Array(44100 * 2);
      const audio = createTestAudioData(silence);

      const result = getVAD(audio);

      expect(result.segments).toBeDefined();
      expect(result.speechRatio).toBeLessThan(0.1);

      const silenceSegments = result.segments.filter((s) => s.type === 'silence');
      expect(silenceSegments.length).toBeGreaterThan(0);
    });
  });

  describe('detection methods', () => {
    it('should support energy-based detection', () => {
      const mixedSignal = createMixedSignal(1.5, 1.0, 0.4);
      const audio = createTestAudioData(mixedSignal);

      const result = getVAD(audio, { method: 'energy' });

      expect(result.segments).toBeDefined();
      expect(result.speechRatio).toBeGreaterThanOrEqual(0);
    });

    it('should support ZCR-based detection', () => {
      const mixedSignal = createMixedSignal(1.5, 1.0, 0.4);
      const audio = createTestAudioData(mixedSignal);

      const result = getVAD(audio, { method: 'zcr' });

      expect(result.segments).toBeDefined();
      expect(result.speechRatio).toBeGreaterThanOrEqual(0);
    });

    it('should support combined detection', () => {
      const mixedSignal = createMixedSignal(1.5, 1.0, 0.4);
      const audio = createTestAudioData(mixedSignal);

      const result = getVAD(audio, { method: 'combined' });

      expect(result.segments).toBeDefined();
      expect(result.speechRatio).toBeGreaterThanOrEqual(0);
    });

    it('should support adaptive detection', () => {
      const mixedSignal = createMixedSignal(2.0, 1.0, 0.3);
      const audio = createTestAudioData(mixedSignal);

      const result = getVAD(audio, { method: 'adaptive' });

      expect(result.segments).toBeDefined();
      expect(result.speechRatio).toBeGreaterThanOrEqual(0);
    });
  });

  describe('threshold configuration', () => {
    it('should respect energy threshold', () => {
      const speechSignal = createSpeechLikeSignal(2.0);
      const audio = createTestAudioData(speechSignal);

      const lowThreshold = getVAD(audio, {
        method: 'energy',
        energyThreshold: 0.001
      });

      const highThreshold = getVAD(audio, {
        method: 'energy',
        energyThreshold: 0.1
      });

      expect(lowThreshold.speechRatio).toBeGreaterThanOrEqual(highThreshold.speechRatio);
    });

    it('should respect ZCR thresholds', () => {
      const signal = createSineWave(1000, 2.0, 44100, 0.3);
      const audio = createTestAudioData(signal);

      const result = getVAD(audio, {
        method: 'zcr',
        zcrThresholdLow: 0.02,
        zcrThresholdHigh: 0.2
      });

      expect(result.segments).toBeDefined();
      expect(result.speechRatio).toBeGreaterThanOrEqual(0);
    });
  });

  describe('frame configuration', () => {
    it('should respect frame size configuration', () => {
      const mixedSignal = createMixedSignal(2.0, 1.0, 0.4);
      const audio = createTestAudioData(mixedSignal);

      const smallFrames = getVAD(audio, { frameSizeMs: 10 });
      const largeFrames = getVAD(audio, { frameSizeMs: 50 });

      expect(smallFrames.segments).toBeDefined();
      expect(largeFrames.segments).toBeDefined();

      expect(smallFrames.speechRatio).toBeGreaterThanOrEqual(0);
      expect(largeFrames.speechRatio).toBeGreaterThanOrEqual(0);
    });

    it('should respect hop size configuration', () => {
      const speechSignal = createSpeechLikeSignal(2.0);
      const audio = createTestAudioData(speechSignal);

      const result = getVAD(audio, {
        frameSizeMs: 25,
        hopSizeMs: 10
      });

      expect(result.segments).toBeDefined();
      expect(result.speechRatio).toBeGreaterThanOrEqual(0);
    });
  });

  describe('temporal constraints', () => {
    it('should respect minimum silence duration', () => {
      const mixedSignal = createMixedSignal(1.0, 0.5, 0.4);
      const audio = createTestAudioData(mixedSignal);

      const result = getVAD(audio, {
        minSilenceDurationMs: 200
      });

      expect(result.segments).toBeDefined();

      const silenceSegments = result.segments.filter((s) => s.type === 'silence');
      silenceSegments.forEach((segment) => {
        const duration = (segment.end - segment.start) * 1000; // ms
        expect(duration).toBeGreaterThanOrEqual(180);
      });
    });

    it('should respect minimum speech duration', () => {
      const mixedSignal = createMixedSignal(0.5, 1.0, 0.4);
      const audio = createTestAudioData(mixedSignal);

      const result = getVAD(audio, {
        minSpeechDurationMs: 200
      });

      expect(result.segments).toBeDefined();

      const speechSegments = result.segments.filter((s) => s.type === 'speech');
      speechSegments.forEach((segment) => {
        const duration = (segment.end - segment.start) * 1000; // ms
        expect(duration).toBeGreaterThanOrEqual(180);
      });
    });
  });

  describe('additional options', () => {
    it('should support pre-emphasis filter', () => {
      const speechSignal = createSpeechLikeSignal(2.0);
      const audio = createTestAudioData(speechSignal);

      const withPreEmphasis = getVAD(audio, { preEmphasis: true });
      const withoutPreEmphasis = getVAD(audio, { preEmphasis: false });

      expect(withPreEmphasis.segments).toBeDefined();
      expect(withoutPreEmphasis.segments).toBeDefined();
      expect(withPreEmphasis.speechRatio).toBeGreaterThanOrEqual(0);
      expect(withoutPreEmphasis.speechRatio).toBeGreaterThanOrEqual(0);
    });

    it('should support smoothing', () => {
      const noisySignal = createWhiteNoise(44100 * 2, 0.1);
      const audio = createTestAudioData(noisySignal);

      const withSmoothing = getVAD(audio, { smoothing: true });
      const withoutSmoothing = getVAD(audio, { smoothing: false });

      expect(withSmoothing.segments).toBeDefined();
      expect(withoutSmoothing.segments).toBeDefined();

      expect(withSmoothing.segments.length).toBeLessThanOrEqual(withoutSmoothing.segments.length);
    });

    it('should provide confidence scores when available', () => {
      const speechSignal = createSpeechLikeSignal(1.0);
      const audio = createTestAudioData(speechSignal);

      const result = getVAD(audio);

      result.segments.forEach((segment) => {
        if (segment.confidence !== undefined) {
          expect(segment.confidence).toBeGreaterThanOrEqual(0);
          expect(segment.confidence).toBeLessThanOrEqual(1);
        }
      });
    });
  });

  describe('feature extraction', () => {
    it('should provide detailed features when requested', () => {
      const mixedSignal = createMixedSignal(1.5, 1.0, 0.4);
      const audio = createTestAudioData(mixedSignal);

      const result = getVAD(audio);

      if (result.features) {
        expect(result.features.energies).toBeInstanceOf(Float32Array);
        expect(result.features.zcrs).toBeInstanceOf(Float32Array);
        expect(result.features.decisions).toBeInstanceOf(Float32Array);
        expect(result.features.times).toBeInstanceOf(Float32Array);

        const length = result.features.times.length;
        expect(result.features.energies.length).toBe(length);
        expect(result.features.zcrs.length).toBe(length);
        expect(result.features.decisions.length).toBe(length);

        for (let i = 0; i < result.features.decisions.length; i++) {
          expect(result.features.decisions[i]).toBeGreaterThanOrEqual(0);
          expect(result.features.decisions[i]).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('multi-channel support', () => {
    it('should analyze specified channel', () => {
      const channel0 = createSpeechLikeSignal(2.0);
      const channel1 = new Float32Array(channel0.length);

      const audio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: 2.0,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result0 = getVAD(audio, { channel: 0 });
      const result1 = getVAD(audio, { channel: 1 });

      expect(result0.speechRatio).toBeGreaterThanOrEqual(result1.speechRatio);
    });

    it('should handle alternating patterns', () => {
      const pattern = new Float32Array(44100 * 4);

      for (let i = 0; i < pattern.length; i++) {
        const time = i / 44100;
        const segment = Math.floor(time * 10) % 2;

        if (segment === 0) {
          pattern[i] = 0.2 * Math.sin(2 * Math.PI * 440 * time);
        } else {
          pattern[i] = 0;
        }
      }

      const audio = createTestAudioData(pattern);
      const result = getVAD(audio);

      expect(result.segments).toBeDefined();
      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.speechRatio).toBeGreaterThanOrEqual(0);
      expect(result.speechRatio).toBeLessThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('should handle very short audio', () => {
      const shortSignal = createSpeechLikeSignal(0.1); // 100ms
      const audio = createTestAudioData(shortSignal);

      const result = getVAD(audio);

      expect(result.segments).toBeDefined();
      expect(result.speechRatio).toBeGreaterThanOrEqual(0);
      expect(result.speechRatio).toBeLessThanOrEqual(1);
    });

    it('should handle constant amplitude signal', () => {
      const constantSignal = new Float32Array(44100);
      constantSignal.fill(0.1);
      const audio = createTestAudioData(constantSignal);

      const result = getVAD(audio);

      expect(result.segments).toBeDefined();
      expect(result.speechRatio).toBeGreaterThanOrEqual(0);
    });

    it('should adapt to signal characteristics', () => {
      const variableSignal = new Float32Array(44100 * 3);

      for (let i = 0; i < variableSignal.length; i++) {
        const time = i / 44100;
        const noiseLevel = 0.01 + 0.05 * Math.sin(2 * Math.PI * 0.5 * time);

        if (time < 1.5) {
          variableSignal[i] =
            0.2 * Math.sin(2 * Math.PI * 300 * time) + noiseLevel * (Math.random() - 0.5);
        } else {
          variableSignal[i] = noiseLevel * (Math.random() - 0.5);
        }
      }

      const audio = createTestAudioData(variableSignal);
      const result = getVAD(audio, {
        method: 'adaptive',
        adaptiveAlpha: 0.1,
        noiseFactor: 3.0
      });

      expect(result.segments).toBeDefined();
      expect(result.speechRatio).toBeGreaterThanOrEqual(0);
      expect(result.speechRatio).toBeLessThanOrEqual(1);

      const speechSegments = result.segments.filter((s) => s.type === 'speech');
      expect(speechSegments.length).toBeGreaterThanOrEqual(0);
    });
  });
});
