import { describe, it, expect } from 'vitest';
import { analyze, getPeaks, getRMS, getZeroCrossing } from '../src/index.js';
import type { AudioData } from '../src/types.js';

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

// 複合信号を生成
function createComplexSignal(sampleRate = 44100, duration = 1): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const data = new Float32Array(length);
  
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // 複数の周波数成分を持つ信号
    data[i] = 
      0.5 * Math.sin(2 * Math.PI * 440 * t) +    // A4
      0.3 * Math.sin(2 * Math.PI * 880 * t) +    // A5
      0.2 * Math.sin(2 * Math.PI * 1320 * t);    // E6
  }
  
  // いくつかの明確なピークを追加
  const peakPositions = [
    Math.floor(0.1 * sampleRate),
    Math.floor(0.3 * sampleRate),
    Math.floor(0.5 * sampleRate),
    Math.floor(0.7 * sampleRate),
    Math.floor(0.9 * sampleRate)
  ];
  
  peakPositions.forEach((pos, i) => {
    if (pos < length) {
      data[pos] = 1.0 - (i * 0.1); // 振幅を変化させる
    }
  });
  
  return data;
}

describe('Integration Tests', () => {
  describe('Full workflow with complex signal', () => {
    it('should analyze complex audio signal successfully', async () => {
      const signal = createComplexSignal(44100, 2);
      const audio = createTestAudioData(signal);
      
      // ピーク検出
      const peaks = await analyze(audio, (audio) => 
        getPeaks(audio, { 
          count: 10, 
          threshold: 0.8,
          minDistance: 1000 
        })
      );
      
      // RMS計算
      const rms = await analyze(audio, getRMS);
      
      // ゼロクロッシング率計算
      const zcr = await analyze(audio, getZeroCrossing);
      
      // 結果の検証
      expect(peaks.peaks.length).toBeGreaterThan(0);
      expect(peaks.peaks.length).toBeLessThanOrEqual(10);
      expect(peaks.maxAmplitude).toBeGreaterThan(0.8);
      
      expect(rms).toBeGreaterThan(0);
      expect(rms).toBeLessThan(1);
      
      expect(zcr).toBeGreaterThan(0);
      expect(zcr).toBeLessThan(1);
      
      // ピークの時間順序確認
      for (let i = 1; i < peaks.peaks.length; i++) {
        expect(peaks.peaks[i]!.time).toBeGreaterThan(peaks.peaks[i-1]!.time);
      }
    });

    it('should handle multiple features in parallel', async () => {
      const signal = createComplexSignal(44100, 1);
      const audio = createTestAudioData(signal);
      
      // 並列実行
      const [peaks, rms, zcr] = await Promise.all([
        analyze(audio, (audio) => getPeaks(audio, { count: 5, threshold: 0.7 })),
        analyze(audio, getRMS),
        analyze(audio, getZeroCrossing)
      ]);
      
      expect(peaks.peaks.length).toBeGreaterThan(0);
      expect(rms).toBeGreaterThan(0);
      expect(zcr).toBeGreaterThan(0);
    });
  });

  describe('Multi-channel audio analysis', () => {
    it('should analyze stereo audio', async () => {
      const leftSignal = createComplexSignal(44100, 1);
      const rightSignal = new Float32Array(leftSignal.length);
      
      // 右チャンネルは左チャンネルの半分の振幅
      for (let i = 0; i < rightSignal.length; i++) {
        rightSignal[i] = leftSignal[i]! * 0.5;
      }
      
      const stereoAudio: AudioData = {
        sampleRate: 44100,
        channelData: [leftSignal, rightSignal],
        duration: leftSignal.length / 44100,
        numberOfChannels: 2,
        length: leftSignal.length
      };
      
      // 各チャンネルを個別に解析
      const leftPeaks = await analyze(stereoAudio, (audio) => 
        getPeaks(audio, { channel: 0, threshold: 0.5 })
      );
      
      const rightPeaks = await analyze(stereoAudio, (audio) => 
        getPeaks(audio, { channel: 1, threshold: 0.5 })
      );
      
      const leftRMS = await analyze(stereoAudio, (audio) => getRMS(audio, 0));
      const rightRMS = await analyze(stereoAudio, (audio) => getRMS(audio, 1));
      
      // 左チャンネルの方が振幅が大きいはず
      expect(leftPeaks.maxAmplitude).toBeGreaterThan(rightPeaks.maxAmplitude);
      expect(leftRMS).toBeGreaterThan(rightRMS);
      
      // 右チャンネルのRMSは左チャンネルの約半分
      expect(rightRMS).toBeCloseTo(leftRMS * 0.5, 1);
    });

    it('should analyze averaged channels', async () => {
      const channel1 = createComplexSignal(44100, 1);
      const channel2 = new Float32Array(channel1.length);
      channel2.fill(0.5); // DC signal
      
      const audio: AudioData = {
        sampleRate: 44100,
        channelData: [channel1, channel2],
        duration: channel1.length / 44100,
        numberOfChannels: 2,
        length: channel1.length
      };
      
      // 全チャンネル平均で解析
      const averagedPeaks = await analyze(audio, (audio) => 
        getPeaks(audio, { channel: -1, threshold: 0.3 })
      );
      
      const averagedRMS = await analyze(audio, (audio) => getRMS(audio, -1));
      
      expect(averagedPeaks.peaks.length).toBeGreaterThan(0);
      expect(averagedRMS).toBeGreaterThan(0);
    });
  });

  describe('Error scenarios integration', () => {
    it('should propagate errors from feature functions', async () => {
      const audio = createTestAudioData(new Float32Array(1000));
      
      const faultyFeature = () => {
        throw new Error('Feature processing failed');
      };
      
      await expect(analyze(audio, faultyFeature))
        .rejects.toThrow('特徴量の抽出に失敗しました');
    });

    it('should handle empty audio gracefully', async () => {
      const emptyAudio = createTestAudioData(new Float32Array(0));
      
      // analyze関数の検証で弾かれるはず
      await expect(analyze(emptyAudio, getPeaks))
        .rejects.toThrow('データ長が無効です');
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle large audio files efficiently', async () => {
      const largeSignal = createComplexSignal(44100, 10); // 10秒のオーディオ
      const audio = createTestAudioData(largeSignal);
      
      const startTime = performance.now();
      
      const [peaks, rms, zcr] = await Promise.all([
        analyze(audio, (audio) => getPeaks(audio, { count: 20 })),
        analyze(audio, getRMS),
        analyze(audio, getZeroCrossing)
      ]);
      
      const endTime = performance.now();
      
      // 処理時間が妥当な範囲内であることを確認
      expect(endTime - startTime).toBeLessThan(5000); // 5秒以内
      
      expect(peaks.peaks.length).toBeLessThanOrEqual(20);
      expect(rms).toBeGreaterThan(0);
      expect(zcr).toBeGreaterThan(0);
    });

    it('should handle different sample rates', async () => {
      const sampleRates = [8000, 16000, 22050, 44100, 48000];
      
      for (const sampleRate of sampleRates) {
        const signal = createComplexSignal(sampleRate, 0.5);
        const audio = createTestAudioData(signal, sampleRate);
        
        const peaks = await analyze(audio, (audio) => 
          getPeaks(audio, { count: 5, threshold: 0.5 })
        );
        
        const rms = await analyze(audio, getRMS);
        
        expect(peaks.peaks.length).toBeGreaterThan(0);
        expect(rms).toBeGreaterThan(0);
        
        // サンプルレートが正しく反映されていることを確認
        expect(audio.sampleRate).toBe(sampleRate);
      }
    });

    it('should maintain consistency across multiple runs', async () => {
      const signal = createComplexSignal(44100, 1);
      const audio = createTestAudioData(signal);
      
      // 同じ音声に対して複数回解析を実行
      const results = await Promise.all([
        analyze(audio, (audio) => getPeaks(audio, { count: 5, threshold: 0.7 })),
        analyze(audio, (audio) => getPeaks(audio, { count: 5, threshold: 0.7 })),
        analyze(audio, (audio) => getPeaks(audio, { count: 5, threshold: 0.7 }))
      ]);
      
      // 結果が一致することを確認
      const firstResult = results[0]!;
      for (let i = 1; i < results.length; i++) {
        const result = results[i]!;
        expect(result.peaks.length).toBe(firstResult.peaks.length);
        expect(result.maxAmplitude).toBe(firstResult.maxAmplitude);
        
        for (let j = 0; j < result.peaks.length; j++) {
          expect(result.peaks[j]!.position).toBe(firstResult.peaks[j]!.position);
          expect(result.peaks[j]!.amplitude).toBe(firstResult.peaks[j]!.amplitude);
        }
      }
    });
  });
}); 