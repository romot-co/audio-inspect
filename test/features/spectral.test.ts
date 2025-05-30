import { describe, it, expect } from 'vitest';
import {
  getSpectralFeatures,
  getTimeVaryingSpectralFeatures
} from '../../src/features/spectral.js';
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

function createComplexSignal(sampleRate = 44100, duration = 1): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const data = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // 複数の周波数成分を含む信号
    data[i] =
      0.5 * Math.sin(2 * Math.PI * 440 * t) +
      0.3 * Math.sin(2 * Math.PI * 880 * t) +
      0.2 * Math.sin(2 * Math.PI * 1320 * t);
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

      // サイン波の場合、重心は440Hz周辺にあるはず
      expect(result.spectralCentroid).toBeGreaterThan(300);
      expect(result.spectralCentroid).toBeLessThan(600);

      // 単一周波数なので帯域幅は狭いはず
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

      // 複数の周波数成分があるので帯域幅は広いはず
      expect(result.spectralBandwidth).toBeGreaterThan(100);

      // 重心は最も強い成分（440Hz）周辺にあるはず
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

      // 高い周波数の方がゼロ交差率が高いはず
      expect(highResult.zeroCrossingRate).toBeGreaterThan(lowResult.zeroCrossingRate);
      expect(highResult.zeroCrossingRate).toBeGreaterThan(0);
      expect(lowResult.zeroCrossingRate).toBeGreaterThan(0);
    });

    it('should handle white noise', async () => {
      const noise = createWhiteNoise(44100, 0.5); // 1秒
      const audio = createTestAudioData(noise);

      const result = await getSpectralFeatures(audio);

      expect(result.spectralCentroid).toBeDefined();
      expect(result.spectralBandwidth).toBeDefined();
      expect(result.spectralRolloff).toBeDefined();
      expect(result.spectralFlatness).toBeDefined();

      // ホワイトノイズは平坦なスペクトラムを持つ
      expect(result.spectralFlatness).toBeGreaterThan(0.1); // 比較的平坦
      expect(result.spectralBandwidth).toBeGreaterThan(1000); // 広い帯域幅
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

      // 異なるFFTサイズでも合理的な結果が得られる
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

      // 窓関数によって若干結果が変わる可能性がある
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

      // 95%の方が85%より高い周波数になるはず
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

      // 異なるチャンネルで異なる重心を持つはず
      expect(result0.spectralCentroid).toBeLessThan(result1.spectralCentroid);
      expect(result0.spectralCentroid).toBeCloseTo(440, -1); // 大まかに440Hz
      expect(result1.spectralCentroid).toBeCloseTo(880, -1); // 大まかに880Hz
    });
  });

  describe('edge cases', () => {
    it('should handle silent signal', async () => {
      const silence = new Float32Array(44100); // 1秒の無音
      const audio = createTestAudioData(silence);

      const result = await getSpectralFeatures(audio);

      expect(result.spectralCentroid).toBeDefined();
      expect(result.spectralBandwidth).toBeDefined();
      expect(result.spectralRolloff).toBeDefined();
      expect(result.spectralFlatness).toBeDefined();
      expect(result.zeroCrossingRate).toBe(0); // 無音なのでゼロ交差なし
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
    it('should calculate spectral flux for time-varying signals', async () => {
      const sweep = createSweep(440, 880, 2.0, 44100); // 2秒のスイープ
      const audio = createTestAudioData(sweep);

      const result = await getSpectralFeatures(audio);

      // スイープ信号はスペクトルが時間変化するのでfluxがあるはず
      if (result.spectralFlux !== undefined) {
        expect(result.spectralFlux).toBeGreaterThan(0);
      }
    });
  });
});

describe('getTimeVaryingSpectralFeatures', () => {
  describe('basic functionality', () => {
    it('should calculate time-varying spectral features', async () => {
      const signal = createComplexSignal(44100, 3.0); // 3秒
      const audio = createTestAudioData(signal);

      const result = await getTimeVaryingSpectralFeatures(audio);

      expect(result.times).toBeDefined();
      expect(result.spectralCentroid).toBeDefined();
      expect(result.spectralBandwidth).toBeDefined();
      expect(result.spectralRolloff).toBeDefined();
      expect(result.spectralFlatness).toBeDefined();
      expect(result.zeroCrossingRate).toBeDefined();

      // 時系列データなので複数のフレームがあるはず
      expect(result.times.length).toBeGreaterThan(1);
      expect(result.spectralCentroid.length).toBe(result.times.length);
      expect(result.spectralBandwidth.length).toBe(result.times.length);
      expect(result.spectralRolloff.length).toBe(result.times.length);
      expect(result.spectralFlatness.length).toBe(result.times.length);
      expect(result.zeroCrossingRate.length).toBe(result.times.length);
    });

    it('should track changes in spectral content over time', async () => {
      // 前半は低い周波数、後半は高い周波数
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

      // 時間とともにスペクトル重心が変化しているはず
      const firstFrameCentroid = result.spectralCentroid[0];
      const lastFrameCentroid = result.spectralCentroid[result.spectralCentroid.length - 1];

      if (firstFrameCentroid !== undefined && lastFrameCentroid !== undefined) {
        expect(lastFrameCentroid).toBeGreaterThan(firstFrameCentroid);
      }
    });

    it('should calculate spectral flux between frames', async () => {
      const sweep = createSweep(200, 2000, 4.0, 44100); // 4秒のスイープ
      const audio = createTestAudioData(sweep);

      const result = await getTimeVaryingSpectralFeatures(audio, {
        frameSize: 1024,
        hopSize: 512
      });

      expect(result.spectralFlux).toBeDefined();
      if (result.spectralFlux) {
        expect(result.spectralFlux.length).toBe(result.times.length);

        // スイープ信号なので全体的にfluxが高いはず
        const avgFlux =
          result.spectralFlux.reduce((sum, val) => sum + val, 0) / result.spectralFlux.length;
        expect(avgFlux).toBeGreaterThan(0);
      }
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

      // 小さなフレーム・ホップサイズの方が多くのフレーム数になるはず
      expect(smallFrames.times.length).toBeGreaterThan(largeFrames.times.length);
    });
  });

  describe('statistics', () => {
    it('should calculate basic statistics for time-varying features', async () => {
      const signal = createSweep(440, 1320, 3.0, 44100);
      const audio = createTestAudioData(signal);

      const result = await getTimeVaryingSpectralFeatures(audio);

      // 時系列データの基本的な特性を確認
      expect(result.times.length).toBeGreaterThan(0);
      expect(result.spectralCentroid.length).toBe(result.times.length);
      expect(result.spectralBandwidth.length).toBe(result.times.length);

      // スイープ信号なので重心が変化しているはず
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

      // チャンネル1の方が一般的に高い周波数を持つはず
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
      const silence = new Float32Array(44100 * 2); // 2秒の無音
      const audio = createTestAudioData(silence);

      const result = await getTimeVaryingSpectralFeatures(audio);

      expect(result.times.length).toBeGreaterThan(0);
      expect(result.spectralCentroid.length).toBe(result.times.length);

      // 全フレームでゼロ交差率が0のはず
      result.zeroCrossingRate.forEach((zcr) => {
        expect(zcr).toBe(0);
      });
    });
  });
});
