import { describe, it, expect } from 'vitest';
import { getPeaks, getRMS, getZeroCrossing, getWaveform } from '../../src/features/time.js';
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

function createPeakSignal(
  peakPositions: number[],
  peakAmplitudes: number[],
  length: number
): Float32Array {
  const data = new Float32Array(length);

  peakPositions.forEach((pos, i) => {
    if (pos < length) {
      const amplitude = peakAmplitudes[i] || 1.0;

      // ピーク点とその周辺を設定してローカルマキシマを作る
      data[pos] = amplitude;

      // 前後の値を少し小さくして、確実にローカルマキシマにする
      if (pos > 0) {
        data[pos - 1] = Math.max(data[pos - 1]!, amplitude * 0.5);
      }
      if (pos < length - 1) {
        data[pos + 1] = Math.max(data[pos + 1]!, amplitude * 0.5);
      }

      // さらに外側も少し設定（他のピークと重ならない限り）
      if (pos > 1) {
        data[pos - 2] = Math.max(data[pos - 2]!, amplitude * 0.2);
      }
      if (pos < length - 2) {
        data[pos + 2] = Math.max(data[pos + 2]!, amplitude * 0.2);
      }
    }
  });

  return data;
}

describe('getPeaks', () => {
  describe('basic functionality', () => {
    it('should detect simple peaks', () => {
      const data = createPeakSignal([100, 200, 300], [1.0, 0.8, 0.9], 500);
      const audio = createTestAudioData(data);

      const result = getPeaks(audio, { threshold: 0.5, minDistance: 10 });

      expect(result.peaks).toHaveLength(3);
      expect(result.peaks[0]?.position).toBe(100);
      expect(result.peaks[1]?.position).toBe(200);
      expect(result.peaks[2]?.position).toBe(300);
    });

    it('should return peaks sorted by time', () => {
      const data = createPeakSignal([300, 100, 200], [0.9, 1.0, 0.8], 500);
      const audio = createTestAudioData(data);

      const result = getPeaks(audio, { threshold: 0.5, minDistance: 10 });

      expect(result.peaks).toHaveLength(3);
      expect(result.peaks[0]?.position).toBe(100);
      expect(result.peaks[1]?.position).toBe(200);
      expect(result.peaks[2]?.position).toBe(300);
    });

    it('should limit number of peaks returned', () => {
      const data = createPeakSignal([100, 200, 300, 400, 500], [1.0, 0.9, 0.8, 0.7, 0.6], 600);
      const audio = createTestAudioData(data);

      const result = getPeaks(audio, { count: 3, threshold: 0.5, minDistance: 10 });

      expect(result.peaks).toHaveLength(3);
      // Should return the 3 highest peaks, sorted by time
      expect(result.peaks.map((p) => p.position)).toEqual([100, 200, 300]);
    });

    it('should respect threshold parameter', () => {
      const data = createPeakSignal([100, 200, 300], [1.0, 0.8, 0.6], 500);
      const audio = createTestAudioData(data);

      const result = getPeaks(audio, { threshold: 0.7, minDistance: 10 });

      expect(result.peaks).toHaveLength(2);
      expect(result.peaks.map((p) => p.position)).toEqual([100, 200]);
    });
  });

  describe('peak timing and amplitude', () => {
    it('should calculate correct time positions', () => {
      const sampleRate = 1000; // 簡単な計算のため
      const data = createPeakSignal([100, 500], [1.0, 0.8], 1000);
      const audio = createTestAudioData(data, sampleRate);

      const result = getPeaks(audio, { threshold: 0.5, minDistance: 10 });

      expect(result.peaks[0]?.time).toBe(0.1); // 100/1000
      expect(result.peaks[1]?.time).toBe(0.5); // 500/1000
    });

    it('should preserve peak amplitudes', () => {
      const data = createPeakSignal([100, 200], [1.0, 0.8], 500);
      const audio = createTestAudioData(data);

      const result = getPeaks(audio, { threshold: 0.5, minDistance: 10 });

      expect(result.peaks[0]?.amplitude).toBe(1.0);
      expect(result.peaks[1]?.amplitude).toBeCloseTo(0.8);
    });
  });

  describe('statistics', () => {
    it('should calculate correct statistics', () => {
      const data = createPeakSignal([100, 200, 300], [1.0, 0.8, 0.6], 500);
      const audio = createTestAudioData(data);

      const result = getPeaks(audio, { threshold: 0.5, minDistance: 10 });

      expect(result.maxAmplitude).toBe(1.0);
      expect(result.averageAmplitude).toBeCloseTo((1.0 + 0.8 + 0.6) / 3);
    });

    it('should handle empty results', () => {
      const data = new Float32Array(500); // All zeros
      const audio = createTestAudioData(data);

      const result = getPeaks(audio, { threshold: 0.5 });

      expect(result.peaks).toHaveLength(0);
      expect(result.maxAmplitude).toBe(0); // -Infinity → 0
      expect(result.averageAmplitude).toBe(0); // NaN → 0
    });
  });

  describe('minimum distance enforcement', () => {
    it('should enforce minimum distance between peaks', () => {
      const data = createPeakSignal([100, 105, 110], [1.0, 0.9, 0.8], 500);
      const audio = createTestAudioData(data);

      const result = getPeaks(audio, { threshold: 0.5, minDistance: 20 });

      // Should only keep the highest peak in the cluster
      expect(result.peaks).toHaveLength(1);
      expect(result.peaks[0]?.position).toBe(100);
      expect(result.peaks[0]?.amplitude).toBe(1.0);
    });

    it('should replace peaks with higher amplitude ones', () => {
      const data = createPeakSignal([100, 105], [0.8, 1.0], 500);
      const audio = createTestAudioData(data);

      const result = getPeaks(audio, { threshold: 0.5, minDistance: 10 });

      // Should keep the higher amplitude peak
      expect(result.peaks).toHaveLength(1);
      expect(result.peaks[0]?.position).toBe(105);
      expect(result.peaks[0]?.amplitude).toBe(1.0);
    });

    it('should use default minDistance based on sample rate', () => {
      const data = new Float32Array(1000);
      data[100] = 1.0;
      data[105] = 0.8; // Very close peak
      const audio = createTestAudioData(data);

      const result = getPeaks(audio, { threshold: 0.5 });
      // Default minDistance should prevent close peaks
      expect(result.peaks.length).toBeLessThanOrEqual(1);
    });
  });

  describe('multi-channel support', () => {
    it('should analyze specified channel', () => {
      const channel0 = createPeakSignal([100], [1.0], 500);
      const channel1 = createPeakSignal([200], [0.8], 500);

      const audio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: 500 / 44100,
        numberOfChannels: 2,
        length: 500
      };

      const resultCh0 = getPeaks(audio, { channel: 0, threshold: 0.5 });
      const resultCh1 = getPeaks(audio, { channel: 1, threshold: 0.5 });

      expect(resultCh0.peaks).toHaveLength(1);
      expect(resultCh0.peaks[0]?.position).toBe(100);

      expect(resultCh1.peaks).toHaveLength(1);
      expect(resultCh1.peaks[0]?.position).toBe(200);
    });

    it('should average all channels when channel is -1', () => {
      const channel0 = createPeakSignal([100], [1.0], 500);
      const channel1 = createPeakSignal([100], [0.6], 500); // Same position

      const audio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: 500 / 44100,
        numberOfChannels: 2,
        length: 500
      };

      const result = getPeaks(audio, { channel: -1, threshold: 0.5 });

      expect(result.peaks).toHaveLength(1);
      expect(result.peaks[0]?.position).toBe(100);
      expect(result.peaks[0]?.amplitude).toBeCloseTo(0.8); // Average of 1.0 and 0.6
    });

    it('should throw error for invalid channel', () => {
      const audio = createTestAudioData(new Float32Array(500));

      expect(() => {
        getPeaks(audio, { channel: 1 }); // Only has channel 0
      }).toThrow('無効なチャンネル番号: 1');

      expect(() => {
        getPeaks(audio, { channel: -2 });
      }).toThrow('無効なチャンネル番号: -2');
    });
  });

  describe('real-world scenarios', () => {
    it('should detect peaks in sine wave with impulses', () => {
      const sineWave = createSineWave(440, 0.1, 44100, 0.3);

      // Add some impulses
      sineWave[1000] = 1.0;
      sineWave[2000] = 0.9;
      sineWave[3000] = 0.8;

      const audio = createTestAudioData(sineWave);
      const result = getPeaks(audio, { threshold: 0.7, count: 10 });

      expect(result.peaks.length).toBeGreaterThan(0);
      expect(result.peaks.some((p) => p.amplitude >= 0.8)).toBe(true);
    });

    it('should handle audio with no clear peaks', () => {
      const noise = new Float32Array(1000);
      for (let i = 0; i < noise.length; i++) {
        noise[i] = (Math.random() - 0.5) * 0.1; // Low amplitude noise
      }

      const audio = createTestAudioData(noise);
      const result = getPeaks(audio, { threshold: 0.5 });

      expect(result.peaks).toHaveLength(0);
    });
  });
});

describe('getRMS', () => {
  it('should calculate RMS for sine wave', () => {
    const sineWave = createSineWave(440, 0.1, 44100, 1.0);
    const audio = createTestAudioData(sineWave);

    const rms = getRMS(audio);

    // RMS of sine wave should be amplitude / sqrt(2)
    expect(rms).toBeCloseTo(1.0 / Math.sqrt(2), 2);
  });

  it('should calculate RMS for DC signal', () => {
    const dcSignal = new Float32Array(1000);
    dcSignal.fill(0.5);
    const audio = createTestAudioData(dcSignal);

    const rms = getRMS(audio);

    expect(rms).toBeCloseTo(0.5);
  });

  it('should return 0 for silent signal', () => {
    const silence = new Float32Array(1000);
    const audio = createTestAudioData(silence);

    const rms = getRMS(audio);

    expect(rms).toBe(0);
  });

  it('should handle different channels', () => {
    const channel0 = new Float32Array(1000);
    channel0.fill(1.0);
    const channel1 = new Float32Array(1000);
    channel1.fill(0.5);

    const audio: AudioData = {
      sampleRate: 44100,
      channelData: [channel0, channel1],
      duration: 1000 / 44100,
      numberOfChannels: 2,
      length: 1000
    };

    const rms0 = getRMS(audio, 0);
    const rms1 = getRMS(audio, 1);

    expect(rms0).toBeCloseTo(1.0);
    expect(rms1).toBeCloseTo(0.5);
  });
});

describe('getZeroCrossing', () => {
  it('should calculate zero crossing rate for sine wave', () => {
    const sineWave = createSineWave(440, 0.1, 44100);
    const audio = createTestAudioData(sineWave);

    const zcr = getZeroCrossing(audio);

    // For a sine wave, zero crossing rate should be approximately 2 * frequency / sampleRate
    const expectedZCR = (2 * 440) / 44100;
    expect(zcr).toBeCloseTo(expectedZCR, 2);
  });

  it('should return 0 for DC signal', () => {
    const dcSignal = new Float32Array(1000);
    dcSignal.fill(1.0);
    const audio = createTestAudioData(dcSignal);

    const zcr = getZeroCrossing(audio);

    expect(zcr).toBe(0);
  });

  it('should calculate for alternating signal', () => {
    const alternating = new Float32Array(1000);
    for (let i = 0; i < alternating.length; i++) {
      alternating[i] = i % 2 === 0 ? 1 : -1;
    }
    const audio = createTestAudioData(alternating);

    const zcr = getZeroCrossing(audio);

    // Should cross zero every sample (999 crossings in 999 transitions)
    expect(zcr).toBeCloseTo(999 / 999);
  });

  it('should handle signals crossing zero', () => {
    const data = new Float32Array([1, -1, 1, -1, 1]);
    const audio = createTestAudioData(data);

    const zcr = getZeroCrossing(audio);

    // 4 zero crossings in 4 transitions (5-1)
    expect(zcr).toBe(4 / 4);
  });

  it('should handle signals at zero', () => {
    const data = new Float32Array([1, 0, -1, 0, 1]);
    const audio = createTestAudioData(data);

    const zcr = getZeroCrossing(audio);

    // Zero crossings: 1>=0 and 0<0 (false), 0>=0 and -1<0 (true), -1<0 and 0>=0 (true), 0>=0 and 1<0 (false)
    // 2 zero crossings in 4 transitions
    expect(zcr).toBe(2 / 4);
  });
});

describe('getWaveform', () => {
  describe('basic functionality', () => {
    it('should generate waveform data with default settings', () => {
      const sineWave = createSineWave(440, 1.0, 1000, 1.0); // 1秒, 1000Hz サンプルレート
      const audio = createTestAudioData(sineWave, 1000);

      const result = getWaveform(audio);

      expect(result.waveform).toHaveLength(60); // デフォルト 60 FPS
      expect(result.frameCount).toBe(60);
      expect(result.samplesPerFrame).toBe(Math.floor(1000 / 60)); // 16サンプル
      expect(result.maxAmplitude).toBeGreaterThan(0);
      expect(result.averageAmplitude).toBeGreaterThan(0);
    });

    it('should respect framesPerSecond option', () => {
      const sineWave = createSineWave(440, 1.0, 1000, 1.0);
      const audio = createTestAudioData(sineWave, 1000);

      const result = getWaveform(audio, { framesPerSecond: 30 });

      expect(result.waveform).toHaveLength(30);
      expect(result.frameCount).toBe(30);
      expect(result.samplesPerFrame).toBe(Math.floor(1000 / 30)); // 33サンプル
    });

    it('should calculate correct time positions', () => {
      const sineWave = createSineWave(440, 1.0, 1000, 1.0);
      const audio = createTestAudioData(sineWave, 1000);

      const result = getWaveform(audio, { framesPerSecond: 10 });

      expect(result.waveform).toHaveLength(10);
      expect(result.waveform[0]?.time).toBeCloseTo(0.05); // 最初のフレーム中央時間
      expect(result.waveform[1]?.time).toBeCloseTo(0.15); // 2番目のフレーム中央時間
      expect(result.waveform[9]?.time).toBeCloseTo(0.95); // 最後のフレーム中央時間
    });
  });

  describe('amplitude calculation methods', () => {
    it('should calculate RMS amplitude correctly', () => {
      const dcSignal = new Float32Array(1000);
      dcSignal.fill(0.5);
      const audio = createTestAudioData(dcSignal, 1000);

      const result = getWaveform(audio, {
        framesPerSecond: 10,
        method: 'rms'
      });

      // DC信号のRMSは値そのもの
      result.waveform.forEach((point) => {
        expect(point.amplitude).toBeCloseTo(0.5);
      });
    });

    it('should calculate peak amplitude correctly', () => {
      const data = new Float32Array(1000);
      // 各フレームに1つずつピークを配置
      for (let i = 0; i < 10; i++) {
        const peakPos = i * 100 + 50; // フレーム中央にピーク
        data[peakPos] = 0.8;
      }
      const audio = createTestAudioData(data, 1000);

      const result = getWaveform(audio, {
        framesPerSecond: 10,
        method: 'peak'
      });

      result.waveform.forEach((point) => {
        expect(point.amplitude).toBeCloseTo(0.8);
      });
    });

    it('should calculate average amplitude correctly', () => {
      const data = new Float32Array(1000);
      data.fill(0.6);
      const audio = createTestAudioData(data, 1000);

      const result = getWaveform(audio, {
        framesPerSecond: 10,
        method: 'average'
      });

      result.waveform.forEach((point) => {
        expect(point.amplitude).toBeCloseTo(0.6);
      });
    });
  });

  describe('multi-channel support', () => {
    it('should analyze specified channel', () => {
      const channel0 = new Float32Array(1000);
      channel0.fill(1.0);
      const channel1 = new Float32Array(1000);
      channel1.fill(0.5);

      const audio: AudioData = {
        sampleRate: 1000,
        channelData: [channel0, channel1],
        duration: 1.0,
        numberOfChannels: 2,
        length: 1000
      };

      const result0 = getWaveform(audio, { channel: 0, framesPerSecond: 10 });
      const result1 = getWaveform(audio, { channel: 1, framesPerSecond: 10 });

      result0.waveform.forEach((point) => {
        expect(point.amplitude).toBeCloseTo(1.0);
      });

      result1.waveform.forEach((point) => {
        expect(point.amplitude).toBeCloseTo(0.5);
      });
    });

    it('should average all channels when channel is -1', () => {
      const channel0 = new Float32Array(1000);
      channel0.fill(1.0);
      const channel1 = new Float32Array(1000);
      channel1.fill(0.5);

      const audio: AudioData = {
        sampleRate: 1000,
        channelData: [channel0, channel1],
        duration: 1.0,
        numberOfChannels: 2,
        length: 1000
      };

      const result = getWaveform(audio, { channel: -1, framesPerSecond: 10 });

      result.waveform.forEach((point) => {
        expect(point.amplitude).toBeCloseTo(0.75); // (1.0 + 0.5) / 2
      });
    });
  });

  describe('edge cases', () => {
    it('should handle very short audio', () => {
      const shortAudio = createTestAudioData(new Float32Array([1, 0, -1]), 1000);

      const result = getWaveform(shortAudio, { framesPerSecond: 10 });

      expect(result.waveform.length).toBeGreaterThan(0);
      expect(result.frameCount).toBeGreaterThan(0);
    });

    it('should handle silent audio', () => {
      const silence = new Float32Array(1000);
      const audio = createTestAudioData(silence, 1000);

      const result = getWaveform(audio, { framesPerSecond: 10 });

      expect(result.maxAmplitude).toBe(0);
      expect(result.averageAmplitude).toBe(0);
      result.waveform.forEach((point) => {
        expect(point.amplitude).toBe(0);
      });
    });

    it('should handle high frame rate', () => {
      const sineWave = createSineWave(440, 1.0, 44100, 1.0);
      const audio = createTestAudioData(sineWave, 44100);

      const result = getWaveform(audio, { framesPerSecond: 1000 });

      expect(result.waveform).toHaveLength(1000);
      expect(result.samplesPerFrame).toBe(Math.floor(44100 / 1000));
    });
  });

  describe('statistics', () => {
    it('should calculate statistics correctly', () => {
      // 振幅が段階的に変化する信号を作成
      const data = new Float32Array(1000);
      for (let i = 0; i < 1000; i++) {
        data[i] = i / 1000; // 0から1まで線形増加
      }
      const audio = createTestAudioData(data, 1000);

      const result = getWaveform(audio, { framesPerSecond: 10, method: 'peak' });

      expect(result.maxAmplitude).toBeCloseTo(1.0, 1);
      expect(result.averageAmplitude).toBeGreaterThan(0);
      expect(result.averageAmplitude).toBeLessThan(result.maxAmplitude);
    });
  });
});
