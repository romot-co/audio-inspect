import { describe, it, expect } from 'vitest';
import { load } from '../../src/core/load.js';
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

describe('load', () => {
  describe('basic functionality', () => {
    it('should load existing AudioData without modification', async () => {
      const originalSignal = createSineWave(440, 1.0, 44100, 0.5);
      const originalAudio = createTestAudioData(originalSignal);

      const result = await load(originalAudio);

      expect(result.sampleRate).toBe(44100);
      expect(result.numberOfChannels).toBe(1);
      expect(result.length).toBe(originalAudio.length);
      expect(result.duration).toBeCloseTo(1.0, 2);
    });

    it('should handle mono conversion', async () => {
      const channel0 = createSineWave(440, 1.0, 44100, 0.5);
      const channel1 = createSineWave(880, 1.0, 44100, 0.3);

      const stereoAudio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: 1.0,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result = await load(stereoAudio, { channels: 'mono' });

      expect(result.numberOfChannels).toBe(1);
      expect(result.channelData.length).toBe(1);
      expect(result.length).toBe(stereoAudio.length);
    });

    it('should handle normalization', async () => {
      const signal = createSineWave(440, 1.0, 44100, 0.3); // 振幅0.3
      const audio = createTestAudioData(signal);

      const result = await load(audio, { normalize: true });

      // 正規化により最大振幅が1.0になる
      let maxAmplitude = 0;
      const channelData = result.channelData[0];
      if (channelData) {
        for (const sample of channelData) {
          maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
        }
      }
      expect(maxAmplitude).toBeCloseTo(1.0, 2);
    });
  });

  describe('sample rate conversion', () => {
    const isOfflineAudioContextAvailable = (): boolean => {
      return typeof OfflineAudioContext !== 'undefined';
    };

    it('should resample from 44.1kHz to 48kHz', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContextが利用できない環境のため、このテストをスキップします');
        return;
      }

      const originalSignal = createSineWave(1000, 1.0, 44100, 0.5);
      const originalAudio = createTestAudioData(originalSignal, 44100);

      const result = await load(originalAudio, { sampleRate: 48000 });

      expect(result.sampleRate).toBe(48000);
      expect(result.numberOfChannels).toBe(1);
      // リサンプリング後の長さは比例的に変化
      expect(result.length).toBeCloseTo((originalAudio.length * 48000) / 44100, 100);
      expect(result.duration).toBeCloseTo(1.0, 2); // 時間は保持される
    });

    it('should resample from 48kHz to 44.1kHz', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContextが利用できない環境のため、このテストをスキップします');
        return;
      }

      const originalSignal = createSineWave(440, 2.0, 48000, 0.7);
      const originalAudio = createTestAudioData(originalSignal, 48000);

      const result = await load(originalAudio, { sampleRate: 44100 });

      expect(result.sampleRate).toBe(44100);
      expect(result.length).toBeCloseTo((originalAudio.length * 44100) / 48000, 100);
      expect(result.duration).toBeCloseTo(2.0, 2);
    });

    it('should handle downsampling to lower rates', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContextが利用できない環境のため、このテストをスキップします');
        return;
      }

      const originalSignal = createSineWave(400, 0.5, 44100, 0.8);
      const originalAudio = createTestAudioData(originalSignal, 44100);

      const result = await load(originalAudio, { sampleRate: 22050 });

      expect(result.sampleRate).toBe(22050);
      expect(result.length).toBeCloseTo(originalAudio.length / 2, 100);
      expect(result.duration).toBeCloseTo(0.5, 2);
    });

    it('should handle upsampling to higher rates', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContextが利用できない環境のため、このテストをスキップします');
        return;
      }

      const originalSignal = createSineWave(200, 1.5, 22050, 0.6);
      const originalAudio = createTestAudioData(originalSignal, 22050);

      const result = await load(originalAudio, { sampleRate: 44100 });

      expect(result.sampleRate).toBe(44100);
      expect(result.length).toBeCloseTo(originalAudio.length * 2, 100);
      expect(result.duration).toBeCloseTo(1.5, 2);
    });

    it('should resample stereo audio correctly', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContextが利用できない環境のため、このテストをスキップします');
        return;
      }

      const channel0 = createSineWave(440, 1.0, 44100, 0.5);
      const channel1 = createSineWave(880, 1.0, 44100, 0.3);

      const stereoAudio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: 1.0,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result = await load(stereoAudio, { sampleRate: 48000 });

      expect(result.sampleRate).toBe(48000);
      expect(result.numberOfChannels).toBe(2);
      expect(result.channelData.length).toBe(2);
      expect(result.length).toBeCloseTo((stereoAudio.length * 48000) / 44100, 100);
    });

    it('should combine resampling with other options', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContextが利用できない環境のため、このテストをスキップします');
        return;
      }

      const channel0 = createSineWave(440, 2.0, 48000, 0.4);
      const channel1 = createSineWave(880, 2.0, 48000, 0.6);

      const stereoAudio: AudioData = {
        sampleRate: 48000,
        channelData: [channel0, channel1],
        duration: 2.0,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result = await load(stereoAudio, {
        sampleRate: 44100,
        channels: 'mono',
        normalize: true
      });

      expect(result.sampleRate).toBe(44100);
      expect(result.numberOfChannels).toBe(1);
      expect(result.length).toBeCloseTo((stereoAudio.length * 44100) / 48000, 100);

      // 正規化の確認
      let maxAmplitude = 0;
      const channelData = result.channelData[0];
      if (channelData) {
        for (const sample of channelData) {
          maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
        }
      }
      expect(maxAmplitude).toBeCloseTo(1.0, 1);
    });

    it('should preserve audio quality during resampling', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContextが利用できない環境のため、このテストをスキップします');
        return;
      }

      // 低周波数のシンプルな信号でテスト
      const originalSignal = createSineWave(220, 1.0, 44100, 1.0);
      const originalAudio = createTestAudioData(originalSignal, 44100);

      const result = await load(originalAudio, { sampleRate: 48000 });

      // リサンプリング後も信号の特性が保持されることを確認
      const channelData = result.channelData[0];
      expect(channelData).toBeDefined();
      if (channelData) {
        expect(channelData.length).toBeGreaterThan(0);

        // 振幅の範囲が合理的であることを確認
        let maxAmplitude = 0;
        for (const sample of channelData) {
          maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
        }
        expect(maxAmplitude).toBeGreaterThan(0.5); // 元の信号に近い振幅
        expect(maxAmplitude).toBeLessThan(1.5); // 過度な増幅がない
      }
    });

    it('should not modify audio when target sample rate matches original', async () => {
      const originalSignal = createSineWave(1000, 1.0, 44100, 0.5);
      const originalAudio = createTestAudioData(originalSignal, 44100);

      const result = await load(originalAudio, { sampleRate: 44100 });

      // サンプルレートが同じ場合、変更されない
      expect(result.sampleRate).toBe(44100);
      expect(result.length).toBe(originalAudio.length);
      const resultChannel = result.channelData[0];
      const originalChannel = originalAudio.channelData[0];
      if (resultChannel && originalChannel) {
        expect(resultChannel).toEqual(originalChannel);
      }
    });

    it('should throw error when OfflineAudioContext is not available and resampling is needed', async () => {
      if (isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContextが利用可能な環境のため、このテストをスキップします');
        return;
      }

      const originalSignal = createSineWave(1000, 1.0, 44100, 0.5);
      const originalAudio = createTestAudioData(originalSignal, 44100);

      await expect(load(originalAudio, { sampleRate: 48000 })).rejects.toThrow(
        'この環境ではサンプルレート変換がサポートされていません'
      );
    });
  });

  describe('error handling', () => {
    it('should handle empty audio data', async () => {
      const emptyAudio = createTestAudioData(new Float32Array(0));

      // サンプルレート変換なしでテスト
      const result = await load(emptyAudio);

      expect(result.length).toBe(0);
      expect(result.sampleRate).toBe(44100);
    });

    it('should preserve channel structure for empty channels', async () => {
      const emptyChannel = new Float32Array(0);
      const emptyAudio: AudioData = {
        sampleRate: 44100,
        channelData: [emptyChannel],
        duration: 0,
        numberOfChannels: 1,
        length: 0
      };

      // サンプルレート変換なし、正規化のみでテスト
      const result = await load(emptyAudio, {
        normalize: true
      });

      expect(result.numberOfChannels).toBe(1);
      expect(result.channelData.length).toBe(1);
      expect(result.length).toBe(0);
    });
  });
});
