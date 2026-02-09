import { describe, it, expect, vi } from 'vitest';
import { getFFT, getSpectrum } from '../../src/features/frequency.js';
import type { AudioData } from '../../src/types.js';
import { FFTProviderFactory } from '../../src/core/dsp/fft-provider.js';
import { FFTProviderCacheStore } from '../../src/core/dsp/fft-runtime.js';

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

function createComplexSignal(
  frequencies: number[],
  amplitudes: number[],
  duration: number,
  sampleRate = 44100
): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const data = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;

    for (let j = 0; j < frequencies.length; j++) {
      const freq = frequencies[j] || 0;
      const amp = amplitudes[j] || 0;
      sample += amp * Math.sin(2 * Math.PI * freq * t);
    }

    data[i] = sample;
  }

  return data;
}

describe('getFFT', () => {
  describe('basic functionality', () => {
    it('should perform FFT analysis with WebFFT provider', async () => {
      const sineWave = createSineWave(440, 0.1, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const result = await getFFT(audio, {
        fftSize: 2048,
        provider: 'webfft'
      });

      expect(result.fftSize).toBe(2048);
      expect(result.providerName).toBe('WebFFT');
      expect(result.windowFunction).toBe('hann');
      expect(result.magnitude).toBeInstanceOf(Float32Array);
      expect(result.frequencies).toBeInstanceOf(Float32Array);
      expect(result.phase).toBeInstanceOf(Float32Array);
      expect(result.complex).toBeInstanceOf(Float32Array);

      const peakIndex = result.frequencies.findIndex((f) => f >= 440);
      expect(peakIndex).toBeGreaterThan(0);
    });

    it('should work with native FFT provider', async () => {
      const sineWave = createSineWave(440, 0.1, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const result = await getFFT(audio, {
        fftSize: 256,
        provider: 'native'
      });

      expect(result.fftSize).toBe(256);
      expect(result.providerName).toBe('Native FFT (Cooley-Tukey)');
      expect(result.magnitude).toBeInstanceOf(Float32Array);
    });

    it('should handle different window functions', async () => {
      const sineWave = createSineWave(440, 0.1, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const windowFunctions = ['hann', 'hamming', 'blackman', 'none'] as const;

      for (const windowFunction of windowFunctions) {
        const result = await getFFT(audio, {
          fftSize: 1024,
          windowFunction,
          provider: 'native'
        });

        expect(result.windowFunction).toBe(windowFunction);
        expect(result.magnitude.length).toBeGreaterThan(0);
      }
    });
  });

  describe('input handling', () => {
    it('should handle zero padding for small inputs', async () => {
      const shortSignal = createSineWave(440, 0.01, 44100, 1.0);
      const audio = createTestAudioData(shortSignal);

      const result = await getFFT(audio, {
        fftSize: 2048,
        provider: 'native'
      });

      expect(result.fftSize).toBe(2048);
      expect(result.magnitude).toBeInstanceOf(Float32Array);
    });

    it('should handle multi-channel audio', async () => {
      const channel0 = createSineWave(440, 0.1, 44100, 1.0);
      const channel1 = createSineWave(880, 0.1, 44100, 0.8);

      const audio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: 0.1,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result0 = await getFFT(audio, {
        channel: 0,
        fftSize: 1024,
        provider: 'native'
      });
      const result1 = await getFFT(audio, {
        channel: 1,
        fftSize: 1024,
        provider: 'native'
      });

      expect(result0.magnitude).toBeInstanceOf(Float32Array);
      expect(result1.magnitude).toBeInstanceOf(Float32Array);

      const maxMag0 = Math.max(...Array.from(result0.magnitude));
      const maxMag1 = Math.max(...Array.from(result1.magnitude));
      expect(maxMag0).not.toBe(maxMag1);
    });
  });
});

describe('getSpectrum', () => {
  describe('single frame analysis', () => {
    it('should perform spectrum analysis', async () => {
      const complexSignal = createComplexSignal([440, 880, 1320], [1.0, 0.8, 0.6], 0.1);
      const audio = createTestAudioData(complexSignal);

      const result = await getSpectrum(audio, {
        fftSize: 2048,
        timeFrames: 1,
        provider: 'native'
      });

      expect(result.frequencies).toBeInstanceOf(Float32Array);
      expect(result.magnitudes).toBeInstanceOf(Float32Array);
      expect(result.decibels).toBeInstanceOf(Float32Array);
      expect(result.spectrogram).toBeUndefined();

      const freq440Index = result.frequencies.findIndex((f) => Math.abs(f - 440) < 50);
      const freq880Index = result.frequencies.findIndex((f) => Math.abs(f - 880) < 50);

      expect(freq440Index).toBeGreaterThan(-1);
      expect(freq880Index).toBeGreaterThan(-1);
    });

    it('should filter frequency range', async () => {
      const complexSignal = createComplexSignal([200, 800, 1600], [1.0, 1.0, 1.0], 0.1);
      const audio = createTestAudioData(complexSignal);

      const result = await getSpectrum(audio, {
        fftSize: 2048,
        minFrequency: 400,
        maxFrequency: 1200,
        timeFrames: 1,
        provider: 'native'
      });

      expect(result.frequencies[0]).toBeGreaterThanOrEqual(400);
      expect(result.frequencies[result.frequencies.length - 1] || 0).toBeLessThanOrEqual(1200);
    });
  });

  describe('spectrogram analysis', () => {
    it('should generate spectrogram', async () => {
      const duration = 0.5;
      const sampleRate = 8000;
      const length = Math.floor(duration * sampleRate);
      const chirp = new Float32Array(length);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const freq = 200 + (800 * t) / duration;
        chirp[i] = Math.sin(2 * Math.PI * freq * t);
      }

      const audio = createTestAudioData(chirp, sampleRate);

      const result = await getSpectrum(audio, {
        fftSize: 256,
        timeFrames: 10,
        overlap: 0.5,
        provider: 'native'
      });

      expect(result.spectrogram).toBeDefined();
      if (result.spectrogram) {
        expect(result.spectrogram.times).toBeInstanceOf(Float32Array);
        expect(result.spectrogram.frequencies).toBeInstanceOf(Float32Array);
        expect(result.spectrogram.intensities).toBeInstanceOf(Array);
        expect(result.spectrogram.intensities.length).toBeGreaterThan(0);
        expect(result.spectrogram.timeFrames).toBeGreaterThan(1);
      }
    });

    it('should provide representative magnitudes for spectrogram mode', async () => {
      const signal = createSineWave(440, 0.5, 8000, 1.0);
      const audio = createTestAudioData(signal, 8000);

      const result = await getSpectrum(audio, {
        fftSize: 256,
        timeFrames: 8,
        overlap: 0.5,
        decibels: true,
        provider: 'native'
      });

      expect(result.spectrogram).toBeDefined();
      expect(result.magnitudes.length).toBeGreaterThan(0);
      expect(result.magnitudes.length).toBe(result.frequencies.length);
    });

    it('should reject invalid overlap values for spectrogram', async () => {
      const signal = createSineWave(440, 0.2, 8000, 1.0);
      const audio = createTestAudioData(signal, 8000);

      const invalidOverlaps = [-0.1, 1, 1.1, Number.POSITIVE_INFINITY, Number.NaN];
      for (const overlap of invalidOverlaps) {
        await expect(
          getSpectrum(audio, {
            fftSize: 256,
            timeFrames: 5,
            overlap,
            provider: 'native'
          })
        ).rejects.toThrow('overlap');
      }
    });

    it('should generate strictly increasing spectrogram times for valid overlap', async () => {
      const signal = createSineWave(440, 0.5, 8000, 1.0);
      const audio = createTestAudioData(signal, 8000);

      const result = await getSpectrum(audio, {
        fftSize: 256,
        timeFrames: 8,
        overlap: 0.5,
        provider: 'native'
      });

      expect(result.spectrogram).toBeDefined();
      if (result.spectrogram) {
        for (let i = 1; i < result.spectrogram.times.length; i++) {
          expect(result.spectrogram.times[i]).toBeGreaterThan(result.spectrogram.times[i - 1] ?? 0);
        }
      }
    });
  });

  describe('spectrogram frequency filtering', () => {
    it('should apply frequency range filtering in spectrogram', async () => {
      const signal = createSineWave(1000, 2.0, 44100, 0.5);
      const audio = createTestAudioData(signal);

      const result = await getSpectrum(audio, {
        timeFrames: 5,
        minFrequency: 800,
        maxFrequency: 1200,
        fftSize: 1024
      });

      expect(result.spectrogram).toBeDefined();
      if (result.spectrogram) {
        expect(result.spectrogram.frequencies[0]).toBeGreaterThanOrEqual(800);
        expect(
          result.spectrogram.frequencies[result.spectrogram.frequencies.length - 1]
        ).toBeLessThanOrEqual(1200);

        result.spectrogram.intensities.forEach((intensity) => {
          expect(intensity.length).toBe(result.spectrogram?.frequencies.length);
        });
      }
    });

    it('should handle short audio data with proper frame calculation', async () => {
      const shortSignal = createSineWave(440, 0.01, 44100, 0.5);
      const audio = createTestAudioData(shortSignal);

      const result = await getSpectrum(audio, {
        timeFrames: 3,
        fftSize: 1024
      });

      expect(result.spectrogram).toBeDefined();
      if (result.spectrogram) {
        expect(result.spectrogram.timeFrames).toBeGreaterThanOrEqual(1);
        expect(result.spectrogram.intensities.length).toBeGreaterThanOrEqual(1);
        expect(result.spectrogram.times.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should handle empty audio data gracefully', async () => {
      const emptySignal = new Float32Array(0);
      const audio = createTestAudioData(emptySignal);

      const result = await getSpectrum(audio, {
        timeFrames: 2,
        fftSize: 512
      });

      expect(result.spectrogram).toBeDefined();
      if (result.spectrogram) {
        expect(result.spectrogram.timeFrames).toBe(0);
        expect(result.spectrogram.intensities.length).toBe(0);
        expect(result.spectrogram.times.length).toBe(0);
      }
    });
  });
});

describe('error handling', () => {
  it('should handle invalid FFT size', async () => {
    const sineWave = createSineWave(440, 0.1);
    const audio = createTestAudioData(sineWave);

    await expect(getFFT(audio, { fftSize: 1000, provider: 'native' })).rejects.toThrow(
      'FFT size must be a power of two'
    );
  });

  it('should handle invalid channel', async () => {
    const sineWave = createSineWave(440, 0.1);
    const audio = createTestAudioData(sineWave);

    await expect(getFFT(audio, { channel: 5 })).rejects.toThrow('Invalid channel number');
  });

  it('returns INITIALIZATION_FAILED when FFT provider creation fails', async () => {
    const sineWave = createSineWave(440, 0.1);
    const audio = createTestAudioData(sineWave);
    const spy = vi
      .spyOn(FFTProviderFactory, 'createProvider')
      .mockRejectedValue(new Error('provider init failed'));

    try {
      await expect(getFFT(audio, { provider: 'native' })).rejects.toMatchObject({
        code: 'INITIALIZATION_FAILED'
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('reuses FFT provider when providerCache is supplied', async () => {
    const sineWave = createSineWave(440, 0.25);
    const audio = createTestAudioData(sineWave);
    const cache = new FFTProviderCacheStore();
    const spy = vi.spyOn(FFTProviderFactory, 'createProvider');

    try {
      await getFFT(audio, { provider: 'native', providerCache: cache });
      await getFFT(audio, { provider: 'native', providerCache: cache });
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
      cache.clear();
    }
  });
});
