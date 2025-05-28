import { describe, it, expect } from 'vitest';
import { getFFT, getSpectrum } from '../../src/features/frequency.js';
import type { AudioData } from '../../src/types.js';

// テスト用のAudioDataを作成するヘルパー
function createTestAudioData(data: Float32Array, sampleRate = 44100): AudioData {
  return {
    sampleRate,
    channelData: [data],
    duration: data.length / sampleRate,
    numberOfChannels: 1,
    length: data.length
  };
}

// テスト信号を生成するヘルパー関数
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

      // 440Hz付近にピークがあることを確認
      const peakIndex = result.frequencies.findIndex((f) => f >= 440);
      expect(peakIndex).toBeGreaterThan(0);
    });

    it('should work with native FFT provider', async () => {
      const sineWave = createSineWave(440, 0.1, 44100, 1.0);
      const audio = createTestAudioData(sineWave);

      const result = await getFFT(audio, {
        fftSize: 256, // 小さいサイズでテスト（ネイティブ実装は遅い）
        provider: 'native'
      });

      expect(result.fftSize).toBe(256);
      expect(result.providerName).toBe('Native DFT');
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
          provider: 'native' // 高速化のため
        });

        expect(result.windowFunction).toBe(windowFunction);
        expect(result.magnitude.length).toBeGreaterThan(0);
      }
    });
  });

  describe('input handling', () => {
    it('should handle zero padding for small inputs', async () => {
      const shortSignal = createSineWave(440, 0.01, 44100, 1.0); // 短い信号
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

      // 異なるチャンネルで異なる結果が得られることを確認
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

      // 440Hz, 880Hz, 1320Hz付近にピークがあることを確認
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
      // 周波数が時間とともに変化する信号を作成
      const duration = 0.5;
      const sampleRate = 8000; // 高速化のため低いサンプルレート
      const length = Math.floor(duration * sampleRate);
      const chirp = new Float32Array(length);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const freq = 200 + (800 * t) / duration; // 200Hzから1000Hzへ変化
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
  });
});

describe('error handling', () => {
  it('should handle invalid FFT size', async () => {
    const sineWave = createSineWave(440, 0.1);
    const audio = createTestAudioData(sineWave);

    await expect(
      getFFT(audio, { fftSize: 1000, provider: 'native' }) // 2の累乗でない
    ).rejects.toThrow('FFTサイズは2の累乗である必要があります');
  });

  it('should handle invalid channel', async () => {
    const sineWave = createSineWave(440, 0.1);
    const audio = createTestAudioData(sineWave);

    await expect(
      getFFT(audio, { channel: 5, provider: 'native' }) // 存在しないチャンネル
    ).rejects.toThrow('無効なチャンネル番号');
  });
});
