import { describe, it, expect } from 'vitest';
import {
  getCQT,
  getMelSpectrogram,
  getSpectralFeatures,
  getTimeVaryingSpectralFeatures,
  getSpectralEntropy,
  getSpectralCrest,
  getMFCC,
  computeDeltaCoefficients
} from '../../src/features/spectral.js';
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

function createComplexSignal(sampleRate = 44100, duration = 1): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const data = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;

    data[i] =
      0.5 * Math.sin(2 * Math.PI * 440 * t) +
      0.3 * Math.sin(2 * Math.PI * 880 * t) +
      0.2 * Math.sin(2 * Math.PI * 1320 * t);
  }

  return data;
}

function createWhiteNoise(lengthOrSampleRate: number, duration?: number): Float32Array {
  if (duration !== undefined) {
    const length = Math.floor(lengthOrSampleRate * duration);
    const noise = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      noise[i] = (Math.random() - 0.5) * 2;
    }

    return noise;
  } else {
    const length = lengthOrSampleRate;
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() - 0.5) * 2;
    }
    return data;
  }
}

function createSweep(
  startFreq: number,
  endFreq: number,
  duration: number,
  sampleRate = 44100
): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const data = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const normalizedTime = t / duration;
    const frequency = startFreq + (endFreq - startFreq) * normalizedTime;
    data[i] = Math.sin(2 * Math.PI * frequency * t);
  }

  return data;
}

describe('getSpectralFeatures', () => {
  describe('basic functionality', () => {
    it('should calculate spectral features for sine wave', async () => {
      const sineWave = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const result = await getSpectralFeatures(audio);

      expect(result.spectralCentroid).toBeDefined();
      expect(result.spectralBandwidth).toBeDefined();
      expect(result.spectralRolloff).toBeDefined();
      expect(result.spectralFlatness).toBeDefined();
      expect(result.zeroCrossingRate).toBeDefined();
      expect(result.frequencyRange).toBeDefined();

      expect(result.spectralCentroid).toBeGreaterThan(300);
      expect(result.spectralCentroid).toBeLessThan(600);

      expect(result.spectralBandwidth).toBeGreaterThan(0);
      expect(result.spectralBandwidth).toBeLessThan(1000);
    });

    it('should handle complex signals', async () => {
      const complexSignal = createComplexSignal(44100, 2.0);
      const audio = createTestAudioData(complexSignal);

      const result = await getSpectralFeatures(audio);

      expect(result.spectralCentroid).toBeDefined();
      expect(result.spectralBandwidth).toBeDefined();
      expect(result.spectralRolloff).toBeDefined();
      expect(result.spectralFlatness).toBeDefined();

      expect(result.spectralBandwidth).toBeGreaterThan(100);

      expect(result.spectralCentroid).toBeGreaterThan(400);
      expect(result.spectralCentroid).toBeLessThan(1000);
    });

    it('should calculate zero crossing rate', async () => {
      const highFreq = createSineWave(2000, 1.0, 44100, 1.0);
      const lowFreq = createSineWave(100, 1.0, 44100, 1.0);

      const highFreqAudio = createTestAudioData(highFreq);
      const lowFreqAudio = createTestAudioData(lowFreq);

      const highResult = await getSpectralFeatures(highFreqAudio);
      const lowResult = await getSpectralFeatures(lowFreqAudio);

      expect(highResult.zeroCrossingRate).toBeGreaterThan(lowResult.zeroCrossingRate);
      expect(highResult.zeroCrossingRate).toBeGreaterThan(0);
      expect(lowResult.zeroCrossingRate).toBeGreaterThan(0);
    });

    it('should handle white noise', async () => {
      const noise = createWhiteNoise(44100, 0.5);
      const audio = createTestAudioData(noise);

      const result = await getSpectralFeatures(audio);

      expect(result.spectralCentroid).toBeDefined();
      expect(result.spectralBandwidth).toBeDefined();
      expect(result.spectralRolloff).toBeDefined();
      expect(result.spectralFlatness).toBeDefined();

      expect(result.spectralFlatness).toBeGreaterThan(0.1);
      expect(result.spectralBandwidth).toBeGreaterThan(1000);
    });
  });

  describe('options handling', () => {
    it('should respect FFT size option', async () => {
      const signal = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(signal);

      const result1024 = await getSpectralFeatures(audio, { fftSize: 1024 });
      const result2048 = await getSpectralFeatures(audio, { fftSize: 2048 });

      expect(result1024.spectralCentroid).toBeDefined();
      expect(result2048.spectralCentroid).toBeDefined();

      expect(Math.abs(result1024.spectralCentroid - result2048.spectralCentroid)).toBeLessThan(100);
    });

    it('should respect frequency range options', async () => {
      const signal = createComplexSignal(44100, 1.0);
      const audio = createTestAudioData(signal);

      const result = await getSpectralFeatures(audio, {
        minFrequency: 200,
        maxFrequency: 2000
      });

      expect(result.frequencyRange.min).toBe(200);
      expect(result.frequencyRange.max).toBe(2000);
      expect(result.spectralCentroid).toBeGreaterThanOrEqual(200);
      expect(result.spectralCentroid).toBeLessThanOrEqual(2000);
    });

    it('should support different window functions', async () => {
      const signal = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(signal);

      const hannResult = await getSpectralFeatures(audio, { windowFunction: 'hann' });
      const hammingResult = await getSpectralFeatures(audio, { windowFunction: 'hamming' });
      const blackmanResult = await getSpectralFeatures(audio, { windowFunction: 'blackman' });

      expect(hannResult.spectralCentroid).toBeDefined();
      expect(hammingResult.spectralCentroid).toBeDefined();
      expect(blackmanResult.spectralCentroid).toBeDefined();

      [hannResult, hammingResult, blackmanResult].forEach((result) => {
        expect(result.spectralCentroid).toBeGreaterThan(300);
        expect(result.spectralCentroid).toBeLessThan(800);
      });
    });

    it('should handle rolloff threshold option', async () => {
      const signal = createComplexSignal(44100, 1.0);
      const audio = createTestAudioData(signal);

      const rolloff85 = await getSpectralFeatures(audio, { rolloffThreshold: 0.85 });
      const rolloff95 = await getSpectralFeatures(audio, { rolloffThreshold: 0.95 });

      expect(rolloff85.spectralRolloff).toBeDefined();
      expect(rolloff95.spectralRolloff).toBeDefined();

      expect(rolloff95.spectralRolloff).toBeGreaterThan(rolloff85.spectralRolloff);
    });
  });

  describe('multi-channel support', () => {
    it('should analyze specified channel', async () => {
      const channel0 = createSineWave(440, 1.0, 44100, 1.0);
      const channel1 = createSineWave(880, 1.0, 44100, 1.0);

      const audio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: 1.0,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result0 = await getSpectralFeatures(audio, { channel: 0 });
      const result1 = await getSpectralFeatures(audio, { channel: 1 });

      expect(result0.spectralCentroid).toBeLessThan(result1.spectralCentroid);
      expect(result0.spectralCentroid).toBeCloseTo(440, -1);
      expect(result1.spectralCentroid).toBeCloseTo(880, -1);
    });
  });

  describe('edge cases', () => {
    it('should handle silent signal', async () => {
      const silence = new Float32Array(44100);
      const audio = createTestAudioData(silence);

      const result = await getSpectralFeatures(audio);

      expect(result.spectralCentroid).toBeDefined();
      expect(result.spectralBandwidth).toBeDefined();
      expect(result.spectralRolloff).toBeDefined();
      expect(result.spectralFlatness).toBeDefined();
      expect(result.zeroCrossingRate).toBe(0);
    });

    it('should handle very short audio', async () => {
      const shortSignal = createSineWave(440, 0.1, 44100, 1.0); // 100ms
      const audio = createTestAudioData(shortSignal);

      const result = await getSpectralFeatures(audio);

      expect(result.spectralCentroid).toBeDefined();
      expect(result.spectralBandwidth).toBeDefined();
      expect(result.spectralRolloff).toBeDefined();
      expect(result.spectralFlatness).toBeDefined();
    });
  });

  describe('spectral flux calculation', () => {
    it('returns 0 spectral flux for single-frame spectralFeatures', async () => {
      const sweep = createSweep(440, 880, 2.0, 44100);
      const audio = createTestAudioData(sweep);

      const result = await getSpectralFeatures(audio);

      expect(result.spectralFlux).toBe(0);
    });
  });
});

describe('getTimeVaryingSpectralFeatures', () => {
  describe('basic functionality', () => {
    it('should calculate time-varying spectral features', async () => {
      const signal = createComplexSignal(44100, 3.0);
      const audio = createTestAudioData(signal);

      const result = await getTimeVaryingSpectralFeatures(audio);

      expect(result.times).toBeDefined();
      expect(result.spectralCentroid).toBeDefined();
      expect(result.spectralBandwidth).toBeDefined();
      expect(result.spectralRolloff).toBeDefined();
      expect(result.spectralFlatness).toBeDefined();
      expect(result.zeroCrossingRate).toBeDefined();

      expect(result.times.length).toBeGreaterThan(1);
      expect(result.spectralCentroid.length).toBe(result.times.length);
      expect(result.spectralBandwidth.length).toBe(result.times.length);
      expect(result.spectralRolloff.length).toBe(result.times.length);
      expect(result.spectralFlatness.length).toBe(result.times.length);
      expect(result.zeroCrossingRate.length).toBe(result.times.length);
    });

    it('should keep centroid near tone frequency for stationary sine wave', async () => {
      const toneFreq = 1000;
      const signal = createSineWave(toneFreq, 2.0, 44100, 1.0);
      const audio = createTestAudioData(signal);

      const result = await getTimeVaryingSpectralFeatures(audio, {
        frameSize: 2048,
        hopSize: 1024,
        minFrequency: 20,
        maxFrequency: 5000
      });

      const centroidMean =
        result.spectralCentroid.reduce((sum, value) => sum + value, 0) /
        result.spectralCentroid.length;
      const rolloffMean =
        result.spectralRolloff.reduce((sum, value) => sum + value, 0) /
        result.spectralRolloff.length;
      const bandwidthMean =
        result.spectralBandwidth.reduce((sum, value) => sum + value, 0) /
        result.spectralBandwidth.length;

      expect(centroidMean).toBeGreaterThan(900);
      expect(centroidMean).toBeLessThan(1100);
      expect(rolloffMean).toBeGreaterThan(900);
      expect(rolloffMean).toBeLessThan(1300);
      expect(bandwidthMean).toBeGreaterThan(0);
      expect(bandwidthMean).toBeLessThan(300);
    });

    it('should track changes in spectral content over time', async () => {
      const firstHalf = createSineWave(440, 1.5, 44100, 1.0);
      const secondHalf = createSineWave(880, 1.5, 44100, 1.0);

      const combinedSignal = new Float32Array(firstHalf.length + secondHalf.length);
      combinedSignal.set(firstHalf, 0);
      combinedSignal.set(secondHalf, firstHalf.length);

      const audio = createTestAudioData(combinedSignal);

      const result = await getTimeVaryingSpectralFeatures(audio, {
        frameSize: 2048,
        hopSize: 1024
      });

      expect(result.times.length).toBeGreaterThan(2);
      expect(result.spectralCentroid.length).toBe(result.times.length);

      const firstFrameCentroid = result.spectralCentroid[0];
      const lastFrameCentroid = result.spectralCentroid[result.spectralCentroid.length - 1];

      if (firstFrameCentroid !== undefined && lastFrameCentroid !== undefined) {
        expect(lastFrameCentroid).toBeGreaterThan(firstFrameCentroid);
      }
    });

    it('should calculate spectral flux between frames', async () => {
      const sweep = createSweep(200, 2000, 4.0, 44100);
      const audio = createTestAudioData(sweep);

      const result = await getTimeVaryingSpectralFeatures(audio, {
        frameSize: 1024,
        hopSize: 512
      });

      expect(result.spectralFlux).toBeDefined();
      if (result.spectralFlux) {
        expect(result.spectralFlux.length).toBe(result.times.length);

        const avgFlux =
          result.spectralFlux.reduce((sum, val) => sum + val, 0) / result.spectralFlux.length;
        expect(avgFlux).toBeGreaterThan(0);
      }
    });

    it('should calculate ZCR from real frame data without zero-padding artifacts', async () => {
      const sampleRate = 44100;
      const duration = 1.0;
      const length = Math.floor(sampleRate * duration);
      const negativeDC = new Float32Array(length);
      negativeDC.fill(-0.25);
      const audio = createTestAudioData(negativeDC, sampleRate);

      const result = await getTimeVaryingSpectralFeatures(audio, {
        frameSize: 1024,
        hopSize: 512,
        fftSize: 2048
      });

      const maxZcr = result.zeroCrossingRate.reduce((max, value) => Math.max(max, value), 0);
      expect(maxZcr).toBe(0);
    });
  });

  describe('frame configuration', () => {
    it('should respect frame size and hop size options', async () => {
      const signal = createComplexSignal(44100, 2.0);
      const audio = createTestAudioData(signal);

      const smallFrames = await getTimeVaryingSpectralFeatures(audio, {
        frameSize: 512,
        hopSize: 256
      });

      const largeFrames = await getTimeVaryingSpectralFeatures(audio, {
        frameSize: 2048,
        hopSize: 1024
      });

      expect(smallFrames.times.length).toBeGreaterThan(largeFrames.times.length);
    });
  });

  describe('statistics', () => {
    it('should calculate basic statistics for time-varying features', async () => {
      const signal = createSweep(440, 1320, 3.0, 44100);
      const audio = createTestAudioData(signal);

      const result = await getTimeVaryingSpectralFeatures(audio);

      expect(result.times.length).toBeGreaterThan(0);
      expect(result.spectralCentroid.length).toBe(result.times.length);
      expect(result.spectralBandwidth.length).toBe(result.times.length);

      const firstCentroid = result.spectralCentroid[0];
      const lastCentroid = result.spectralCentroid[result.spectralCentroid.length - 1];

      if (firstCentroid !== undefined && lastCentroid !== undefined) {
        expect(lastCentroid).toBeGreaterThan(firstCentroid);
      }
    });
  });

  describe('multi-channel time-varying analysis', () => {
    it('should analyze specified channel over time', async () => {
      const channel0 = createSweep(440, 880, 2.0, 44100);
      const channel1 = createSweep(880, 1760, 2.0, 44100);

      const audio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: 2.0,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result0 = await getTimeVaryingSpectralFeatures(audio, { channel: 0 });
      const result1 = await getTimeVaryingSpectralFeatures(audio, { channel: 1 });

      expect(result0.times.length).toBeGreaterThan(1);
      expect(result1.times.length).toBeGreaterThan(1);

      if (result0.spectralCentroid[0] !== undefined && result1.spectralCentroid[0] !== undefined) {
        expect(result1.spectralCentroid[0]).toBeGreaterThan(result0.spectralCentroid[0]);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very short audio for time-varying analysis', async () => {
      const shortSignal = createSineWave(440, 0.5, 44100, 1.0); // 500ms
      const audio = createTestAudioData(shortSignal);

      const result = await getTimeVaryingSpectralFeatures(audio);

      expect(result.times.length).toBeGreaterThan(0);
      expect(result.spectralCentroid.length).toBe(result.times.length);
    });

    it('should handle silent audio for time-varying analysis', async () => {
      const silence = new Float32Array(44100 * 2);
      const audio = createTestAudioData(silence);

      const result = await getTimeVaryingSpectralFeatures(audio);

      expect(result.times.length).toBeGreaterThan(0);
      expect(result.spectralCentroid.length).toBe(result.times.length);

      result.zeroCrossingRate.forEach((zcr) => {
        expect(zcr).toBe(0);
      });
    });
  });
});

describe('getSpectralEntropy', () => {
  describe('basic functionality', () => {
    it('should calculate spectral entropy for pure tone', async () => {
      const signal = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(signal);

      const result = await getSpectralEntropy(audio);

      expect(result.entropy).toBeDefined();
      expect(result.entropyNorm).toBeDefined();
      expect(result.frequencyRange).toBeDefined();

      expect(result.entropy).toBeGreaterThan(0);
      expect(result.entropyNorm).toBeGreaterThanOrEqual(0);
      expect(result.entropyNorm).toBeLessThanOrEqual(1);
    });

    it('should calculate higher entropy for noise', async () => {
      const noise = createWhiteNoise(44100, 1.0);
      const audio = createTestAudioData(noise);

      const result = await getSpectralEntropy(audio);

      expect(result.entropy).toBeDefined();
      expect(result.entropyNorm).toBeDefined();

      expect(result.entropy).toBeGreaterThan(0);
      expect(result.entropyNorm).toBeGreaterThan(0.5);
    });

    it('should handle frequency range options', async () => {
      const signal = createSineWave(1000, 1.0, 44100, 1.0);
      const audio = createTestAudioData(signal);

      const result = await getSpectralEntropy(audio, {
        minFrequency: 500,
        maxFrequency: 1500
      });

      expect(result.frequencyRange.min).toBe(500);
      expect(result.frequencyRange.max).toBe(1500);
      expect(result.entropy).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle silent audio', async () => {
      const silence = new Float32Array(44100);
      const audio = createTestAudioData(silence);

      const result = await getSpectralEntropy(audio);

      expect(result.entropy).toBeDefined();
      expect(result.entropyNorm).toBeDefined();

      expect(result.entropy).toBeGreaterThanOrEqual(0);
    });

    it('should handle multi-channel audio', async () => {
      const channel0 = createSineWave(440, 1.0, 44100, 1.0);
      const channel1 = createSineWave(880, 1.0, 44100, 1.0);

      const audio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: 1.0,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result0 = await getSpectralEntropy(audio, { channel: 0 });
      const result1 = await getSpectralEntropy(audio, { channel: 1 });

      expect(result0.entropy).toBeDefined();
      expect(result1.entropy).toBeDefined();

      expect(Math.abs(result0.entropy - result1.entropy)).toBeLessThan(1.0);
    });
  });
});

describe('getSpectralCrest', () => {
  describe('basic functionality', () => {
    it('should calculate spectral crest factor for pure tone', async () => {
      const signal = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(signal);

      const result = await getSpectralCrest(audio);

      expect(result.crest).toBeDefined();
      expect(result.peak).toBeDefined();
      expect(result.average).toBeDefined();
      expect(result.frequencyRange).toBeDefined();

      expect(result.crest).toBeGreaterThan(1);
      expect(result.peak).toBeGreaterThan(result.average);
    });

    it('should calculate lower crest factor for noise', async () => {
      const noise = createWhiteNoise(44100, 1.0);
      const audio = createTestAudioData(noise);

      const result = await getSpectralCrest(audio);

      expect(result.crest).toBeDefined();
      expect(result.peak).toBeDefined();
      expect(result.average).toBeDefined();

      expect(result.crest).toBeGreaterThan(0);
      expect(result.crest).toBeLessThan(10);
    });

    it('should return dB values when requested', async () => {
      const signal = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(signal);

      const result = await getSpectralCrest(audio, { asDB: true });

      expect(result.crest).toBeDefined();
      expect(result.crestDB).toBeDefined();
      expect(result.crestDB).toBeGreaterThan(0);
    });

    it('should handle frequency range options', async () => {
      const signal = createSineWave(1000, 1.0, 44100, 1.0);
      const audio = createTestAudioData(signal);

      const result = await getSpectralCrest(audio, {
        minFrequency: 500,
        maxFrequency: 1500
      });

      expect(result.frequencyRange.min).toBe(500);
      expect(result.frequencyRange.max).toBe(1500);
      expect(result.crest).toBeGreaterThan(1);
    });
  });

  describe('edge cases', () => {
    it('should handle silent audio', async () => {
      const silence = new Float32Array(44100);
      const audio = createTestAudioData(silence);

      const result = await getSpectralCrest(audio);

      expect(result.crest).toBeDefined();
      expect(result.peak).toBeDefined();
      expect(result.average).toBeDefined();

      expect(result.crest).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('getMFCC', () => {
  describe('basic functionality', () => {
    it('should calculate MFCC coefficients', async () => {
      const signal = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(signal);

      const result = await getMFCC(audio);

      expect(result.mfcc).toBeDefined();
      expect(result.mfcc.length).toBeGreaterThan(0);
      expect(result.frameInfo.numFrames).toBeGreaterThan(0);
      expect(result.frameInfo.numCoeffs).toBe(13);

      result.mfcc.forEach((frame) => {
        expect(frame.length).toBe(result.frameInfo.numCoeffs);
      });
    });

    it('should handle custom MFCC parameters', async () => {
      const signal = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(signal);

      const result = await getMFCC(audio, {
        numMfccCoeffs: 20,
        numMelFilters: 40,
        frameSizeMs: 50,
        hopSizeMs: 25
      });

      expect(result.frameInfo.numCoeffs).toBe(20);
      expect(result.mfcc.length).toBeGreaterThan(0);

      result.mfcc.forEach((frame) => {
        expect(frame.length).toBe(20);
      });
    });

    it('should handle frequency range options', async () => {
      const signal = createSineWave(1000, 1.0, 44100, 1.0);
      const audio = createTestAudioData(signal);

      const result = await getMFCC(audio, {
        minFrequency: 300,
        maxFrequency: 8000
      });

      expect(result.frequencyRange.min).toBe(300);
      expect(result.frequencyRange.max).toBe(8000);
      expect(result.mfcc.length).toBeGreaterThan(0);
    });

    it('should apply pre-emphasis when enabled', async () => {
      const signal = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(signal);

      const withPreEmphasis = await getMFCC(audio, { preEmphasis: 0.97 });
      const withoutPreEmphasis = await getMFCC(audio, { preEmphasis: 0 });

      expect(withPreEmphasis.mfcc.length).toBe(withoutPreEmphasis.mfcc.length);

      const firstFrameWith = withPreEmphasis.mfcc[0];
      const firstFrameWithout = withoutPreEmphasis.mfcc[0];
      if (
        firstFrameWith &&
        firstFrameWithout &&
        firstFrameWith[0] !== undefined &&
        firstFrameWithout[0] !== undefined
      ) {
        expect(firstFrameWith[0]).not.toBe(firstFrameWithout[0]);
      }
    });

    it('should apply liftering when enabled', async () => {
      const signal = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(signal);

      const withLiftering = await getMFCC(audio, { lifterCoeff: 22 });
      const withoutLiftering = await getMFCC(audio, { lifterCoeff: 0 });

      expect(withLiftering.mfcc.length).toBe(withoutLiftering.mfcc.length);

      expect(withLiftering.mfcc[0]).not.toEqual(withoutLiftering.mfcc[0]);
    });
  });

  describe('edge cases', () => {
    it('should handle silent audio', async () => {
      const silence = new Float32Array(44100);
      const audio = createTestAudioData(silence);

      const result = await getMFCC(audio);

      expect(result.mfcc).toBeDefined();
      expect(result.mfcc.length).toBeGreaterThan(0);
      expect(result.frameInfo.numFrames).toBeGreaterThan(0);

      result.mfcc.forEach((frame) => {
        frame.forEach((coeff) => {
          expect(isFinite(coeff) || isNaN(coeff)).toBe(true);
        });
      });
    });

    it('should handle short audio', async () => {
      const shortSignal = createSineWave(440, 0.1, 44100, 1.0); // 100ms
      const audio = createTestAudioData(shortSignal);

      const result = await getMFCC(audio);

      expect(result.mfcc).toBeDefined();
      expect(result.frameInfo.numFrames).toBeGreaterThan(0);
      expect(result.frameInfo.numCoeffs).toBe(13);
    });

    it('should handle multi-channel audio', async () => {
      const channel0 = createSineWave(440, 1.0, 44100, 1.0);
      const channel1 = createSineWave(880, 1.0, 44100, 1.0);

      const audio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: 1.0,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result0 = await getMFCC(audio, { channel: 0 });
      const result1 = await getMFCC(audio, { channel: 1 });

      expect(result0.mfcc.length).toBeGreaterThan(0);
      expect(result1.mfcc.length).toBeGreaterThan(0);
      expect(result0.frameInfo.numFrames).toBe(result1.frameInfo.numFrames);
      expect(result0.frameInfo.numCoeffs).toBe(result1.frameInfo.numCoeffs);

      expect(result0.mfcc[0]).not.toEqual(result1.mfcc[0]);
    });
  });

  describe('performance', () => {
    it('should handle large audio efficiently', async () => {
      const longSignal = createSineWave(440, 10.0, 44100, 1.0);
      const audio = createTestAudioData(longSignal);

      const startTime = performance.now();
      const result = await getMFCC(audio);
      const endTime = performance.now();

      expect(result.mfcc.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});

describe('getMelSpectrogram', () => {
  it('should calculate mel spectrogram with default options', async () => {
    const signal = createComplexSignal(44100, 1.0);
    const audio = createTestAudioData(signal);

    const result = await getMelSpectrogram(audio);

    expect(result.melSpectrogram.length).toBeGreaterThan(0);
    expect(result.frameInfo.numFrames).toBeGreaterThan(0);
    expect(result.frameInfo.numBins).toBe(80);
    expect(result.melFrequencies.length).toBe(80);
    expect(result.melSpectrogram[0]?.length).toBe(80);
  });

  it('should support non-log output and custom mel bins', async () => {
    const signal = createSineWave(880, 1.0, 44100, 0.7);
    const audio = createTestAudioData(signal);

    const result = await getMelSpectrogram(audio, {
      numMelFilters: 64,
      logScale: false,
      power: 1
    });

    expect(result.frameInfo.numBins).toBe(64);
    expect(result.melSpectrogram[0]?.length).toBe(64);
    expect((result.melSpectrogram[0] ?? []).every((value) => value >= 0)).toBe(true);
  });

  it('should support fractional power values', async () => {
    const signal = createSineWave(880, 1.0, 44100, 0.7);
    const audio = createTestAudioData(signal);

    const result = await getMelSpectrogram(audio, {
      numMelFilters: 32,
      logScale: false,
      power: 0.5
    });

    expect(result.frameInfo.numBins).toBe(32);
    expect((result.melSpectrogram[0] ?? []).every((value) => value >= 0)).toBe(true);
  });

  it('should reject non-positive power values', async () => {
    const signal = createSineWave(440, 0.5, 44100, 0.7);
    const audio = createTestAudioData(signal);

    await expect(
      getMelSpectrogram(audio, {
        power: 0
      })
    ).rejects.toThrow('power must be a positive finite number');
  });
});

describe('getCQT', () => {
  it('should calculate cqt-like log-frequency representation', async () => {
    const signal = createSweep(55, 1760, 1.2, 44100);
    const audio = createTestAudioData(signal);

    const result = await getCQT(audio, {
      fMin: 55,
      binsPerOctave: 12,
      numBins: 48
    });

    expect(result.cqt.length).toBeGreaterThan(0);
    expect(result.frameInfo.numBins).toBe(48);
    expect(result.frequencies.length).toBe(48);
    expect(result.cqt[0]?.length).toBe(48);
    expect(result.frequencyRange.min).toBeGreaterThan(0);
    expect(result.frequencyRange.max).toBeGreaterThan(result.frequencyRange.min);
  });

  it('should support linear-scale cqt output', async () => {
    const signal = createSineWave(440, 1.0, 44100, 1.0);
    const audio = createTestAudioData(signal);

    const result = await getCQT(audio, {
      logScale: false,
      power: 2,
      numBins: 36
    });

    expect(result.cqt[0]?.length).toBe(36);
    expect((result.cqt[0] ?? []).every((value) => value >= 0)).toBe(true);
  });
});

describe('computeDeltaCoefficients', () => {
  describe('basic functionality', () => {
    it('should compute delta coefficients correctly', () => {
      const coefficients = [
        [1, 2, 3],
        [2, 3, 4],
        [3, 4, 5],
        [4, 5, 6],
        [5, 6, 7]
      ];

      const result = computeDeltaCoefficients(coefficients, 1);

      expect(result.delta).toBeDefined();
      expect(result.deltaDelta).toBeDefined();
      expect(result.delta.length).toBe(coefficients.length);
      expect(result.deltaDelta.length).toBe(coefficients.length);

      result.delta.forEach((frame) => {
        expect(frame.length).toBe(3);
        frame.forEach((coeff) => {
          expect(coeff).toBeGreaterThan(0);
          expect(isFinite(coeff)).toBe(true);
        });
      });
    });

    it('should handle different window sizes', () => {
      const coefficients = [
        [1, 2],
        [3, 5],
        [2, 4],
        [6, 8],
        [4, 6]
      ];

      const result1 = computeDeltaCoefficients(coefficients, 1);
      const result2 = computeDeltaCoefficients(coefficients, 2);

      expect(result1.delta.length).toBe(result2.delta.length);
      expect(result1.deltaDelta.length).toBe(result2.deltaDelta.length);

      expect(result1.delta[2]).not.toEqual(result2.delta[2]);
    });

    it('should handle constant coefficients', () => {
      const coefficients = [
        [5, 3, 1],
        [5, 3, 1],
        [5, 3, 1],
        [5, 3, 1],
        [5, 3, 1]
      ];

      const result = computeDeltaCoefficients(coefficients, 2);

      result.delta.forEach((frame) => {
        frame.forEach((coeff) => {
          expect(coeff).toBeCloseTo(0, 5);
        });
      });

      result.deltaDelta.forEach((frame) => {
        frame.forEach((coeff) => {
          expect(coeff).toBeCloseTo(0, 5);
        });
      });
    });

    it('should handle empty input', () => {
      const emptyCoefficients: number[][] = [];
      const result = computeDeltaCoefficients(emptyCoefficients);

      expect(result.delta).toEqual([]);
      expect(result.deltaDelta).toEqual([]);
    });

    it('should handle single frame', () => {
      const singleFrame = [[1, 2, 3]];
      const result = computeDeltaCoefficients(singleFrame);

      expect(result.delta.length).toBe(1);
      expect(result.deltaDelta.length).toBe(1);
      expect(result.delta[0]).toEqual([0, 0, 0]);
      expect(result.deltaDelta[0]).toEqual([0, 0, 0]);
    });
  });

  describe('edge cases', () => {
    it('should handle varying frame sizes', () => {
      const varyingCoefficients = [
        [1, 2, 3, 4],
        [2, 3],
        [3, 4, 5, 6, 7],
        [4, 5, 6]
      ];

      const result = computeDeltaCoefficients(varyingCoefficients);

      expect(result.delta.length).toBe(4);
      expect(result.deltaDelta.length).toBe(4);

      expect(result.delta[0]?.length).toBe(4);
      expect(result.delta[1]?.length).toBe(4);
      expect(result.delta[2]?.length).toBe(4);
      expect(result.delta[3]?.length).toBe(4);
    });

    it('should handle NaN and undefined values gracefully', () => {
      const coefficientsWithNaN = [[1, NaN, 3], [2, 3, 4], [undefined, 4, 5] as any];

      expect(() => {
        const result = computeDeltaCoefficients(coefficientsWithNaN);
        expect(result.delta).toBeDefined();
        expect(result.deltaDelta).toBeDefined();
      }).not.toThrow();
    });
  });
});
