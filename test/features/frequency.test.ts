import { describe, it, expect, vi } from 'vitest';
import { getFFT, getSpectrum, getSpectrogram } from '../../src/features/frequency.js';
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

function maxValue(values: Float32Array): number {
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const value = values[i] ?? -Infinity;
    if (value > max) {
      max = value;
    }
  }
  return max;
}

describe('getFFT', () => {
  it('performs FFT analysis with WebFFT provider', async () => {
    const sineWave = createSineWave(440, 0.1, 44100, 1.0);
    const audio = createTestAudioData(sineWave);

    const result = await getFFT(audio, {
      fftSize: 2048,
      provider: 'webfft'
    });

    expect(result.fftSize).toBe(2048);
    expect(result.providerName).toBe('WebFFT');
    expect(result.windowFunction).toBe('hann');
    expect(result.normalization).toBe('amplitude');
    expect(result.magnitude).toBeInstanceOf(Float32Array);
    expect(result.frequencies).toBeInstanceOf(Float32Array);
    expect(result.phase).toBeInstanceOf(Float32Array);
    expect(result.complex).toBeInstanceOf(Float32Array);
  });

  it('supports normalization modes', async () => {
    const sampleRate = 8192;
    const fftSize = 1024;
    const sineWave = createSineWave(512, 0.5, sampleRate, 1.0);
    const audio = createTestAudioData(sineWave, sampleRate);

    const normalized = await getFFT(audio, {
      fftSize,
      provider: 'native',
      normalization: 'amplitude',
      windowFunction: 'none'
    });
    const raw = await getFFT(audio, {
      fftSize,
      provider: 'native',
      normalization: 'none',
      windowFunction: 'none'
    });

    const normalizedPeak = maxValue(normalized.magnitude);
    const rawPeak = maxValue(raw.magnitude);

    expect(normalizedPeak).toBeGreaterThan(0.95);
    expect(normalizedPeak).toBeLessThan(1.05);
    expect(rawPeak).toBeGreaterThan(100);
  });
});

describe('getSpectrum', () => {
  it('returns dBFS values by default', async () => {
    const sampleRate = 8192;
    const sineWave = createSineWave(1024, 0.5, sampleRate, 1.0);
    const audio = createTestAudioData(sineWave, sampleRate);

    const result = await getSpectrum(audio, {
      fftSize: 1024,
      windowFunction: 'none',
      provider: 'native'
    });

    expect(result.scale).toBe('dbfs');
    expect(result.frequencies).toBeInstanceOf(Float32Array);
    expect(result.values).toBeInstanceOf(Float32Array);
    const peak = maxValue(result.values);
    expect(peak).toBeGreaterThan(-1);
    expect(peak).toBeLessThan(0.5);
  });

  it('supports linear amplitude output', async () => {
    const sampleRate = 8192;
    const sineWave = createSineWave(1024, 0.5, sampleRate, 1.0);
    const audio = createTestAudioData(sineWave, sampleRate);

    const result = await getSpectrum(audio, {
      fftSize: 1024,
      windowFunction: 'none',
      provider: 'native',
      scale: 'amplitude'
    });

    expect(result.scale).toBe('amplitude');
    expect(maxValue(result.values)).toBeGreaterThan(0.95);
  });

  it('applies frequency range filtering', async () => {
    const signal = createSineWave(1000, 0.2, 8000, 1.0);
    const audio = createTestAudioData(signal, 8000);

    const result = await getSpectrum(audio, {
      fftSize: 512,
      minFrequency: 800,
      maxFrequency: 1200,
      provider: 'native'
    });

    expect(result.frequencies[0]).toBeGreaterThanOrEqual(800);
    expect(result.frequencies[result.frequencies.length - 1] || 0).toBeLessThanOrEqual(1200);
  });
});

describe('getSpectrogram', () => {
  it('returns a multi-frame spectrogram', async () => {
    const signal = createSineWave(440, 1.0, 8000, 1.0);
    const audio = createTestAudioData(signal, 8000);

    const result = await getSpectrogram(audio, {
      frameSize: 256,
      hopSize: 128,
      fftSize: 512,
      maxFrames: 10,
      scale: 'dbfs',
      provider: 'native'
    });

    expect(result.scale).toBe('dbfs');
    expect(result.frameCount).toBeGreaterThan(1);
    expect(result.frameCount).toBeLessThanOrEqual(10);
    expect(result.times.length).toBe(result.frameCount);
    expect(result.frames.length).toBe(result.frameCount);
    expect(result.frequencyBins).toBe(result.frequencies.length);
    for (const frame of result.frames) {
      expect(frame.length).toBe(result.frequencies.length);
    }
    for (let i = 1; i < result.times.length; i++) {
      expect(result.times[i]).toBeGreaterThan(result.times[i - 1] ?? 0);
    }
  });

  it('handles short audio as a single frame', async () => {
    const signal = createSineWave(440, 0.01, 44100, 1.0);
    const audio = createTestAudioData(signal);

    const result = await getSpectrogram(audio, {
      frameSize: 2048,
      hopSize: 1024,
      fftSize: 2048,
      provider: 'native'
    });

    expect(result.frameCount).toBe(1);
    expect(result.frames.length).toBe(1);
  });

  it('returns empty output for empty audio', async () => {
    const audio = createTestAudioData(new Float32Array(0), 44100);

    const result = await getSpectrogram(audio, {
      frameSize: 512,
      hopSize: 256,
      fftSize: 512,
      provider: 'native'
    });

    expect(result.frameCount).toBe(0);
    expect(result.frames.length).toBe(0);
    expect(result.times.length).toBe(0);
  });
});

describe('error handling', () => {
  it('throws for invalid FFT size', async () => {
    const sineWave = createSineWave(440, 0.1);
    const audio = createTestAudioData(sineWave);

    await expect(getFFT(audio, { fftSize: 1000, provider: 'native' })).rejects.toThrow(
      'FFT size must be a power of two'
    );
  });

  it('throws for invalid channel', async () => {
    const sineWave = createSineWave(440, 0.1);
    const audio = createTestAudioData(sineWave);

    await expect(getFFT(audio, { channel: 5 })).rejects.toThrow('Invalid channel number');
  });

  it('throws when dbfs scale is used without amplitude normalization', async () => {
    const sineWave = createSineWave(440, 0.1);
    const audio = createTestAudioData(sineWave);

    await expect(
      getSpectrum(audio, {
        scale: 'dbfs',
        normalization: 'none'
      })
    ).rejects.toThrow('normalization');
  });

  it('throws when frameSize is larger than fftSize', async () => {
    const sineWave = createSineWave(440, 0.1);
    const audio = createTestAudioData(sineWave);

    await expect(
      getSpectrogram(audio, {
        frameSize: 2048,
        fftSize: 1024
      })
    ).rejects.toThrow('frameSize must be <= fftSize');
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
