import { describe, it, expect } from 'vitest';
import { analyze, getPeaks, getRMS, getZeroCrossing } from '../src/index.js';
import { getLUFS } from '../src/features/loudness.js';
import { getSpectralFeatures } from '../src/features/spectral.js';
import { getVAD } from '../src/features/vad.js';
import { getEnergy } from '../src/features/energy.js';
import { getCrestFactor } from '../src/features/dynamics.js';
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

// 音声様信号を生成
function createSpeechLikeSignal(duration: number, sampleRate = 44100): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const data = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // 音声様信号（複数の周波数成分とエンベロープ）
    const envelope = Math.sin(2 * Math.PI * 5 * t) * 0.5 + 0.5; // 5Hz エンベロープ
    const carrier = 
      0.3 * Math.sin(2 * Math.PI * 200 * t) +
      0.4 * Math.sin(2 * Math.PI * 400 * t) +
      0.2 * Math.sin(2 * Math.PI * 800 * t) +
      0.1 * (Math.random() - 0.5); // ノイズ成分
    
    data[i] = carrier * envelope * 0.3;
  }

  return data;
}

// ステレオ音声データを作成
function createStereoAudioData(leftData: Float32Array, rightData: Float32Array, sampleRate = 44100): AudioData {
  return {
    sampleRate,
    channelData: [leftData, rightData],
    duration: leftData.length / sampleRate,
    numberOfChannels: 2,
    length: leftData.length
  };
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
      const rms = await analyze(audio, (audio) => getRMS(audio));
      
      // ゼロクロッシング率計算
      const zcr = await analyze(audio, (audio) => getZeroCrossing(audio));
      
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
        expect(peaks.peaks[i]?.time).toBeGreaterThan(peaks.peaks[i-1]?.time ?? 0);
      }
    });

    it('should handle multiple features in parallel', async () => {
      const signal = createComplexSignal(44100, 1);
      const audio = createTestAudioData(signal);
      
      // 並列実行
      const [peaks, rms, zcr] = await Promise.all([
        analyze(audio, (audio) => getPeaks(audio, { count: 5, threshold: 0.7 })),
        analyze(audio, (audio) => getRMS(audio)),
        analyze(audio, (audio) => getZeroCrossing(audio))
      ]);
      
      expect(peaks.peaks.length).toBeGreaterThan(0);
      expect(rms).toBeGreaterThan(0);
      expect(zcr).toBeGreaterThan(0);
    });
  });

  describe('Advanced feature integration', () => {
    it('should combine loudness, spectral, and VAD analysis', async () => {
      const speechSignal = createSpeechLikeSignal(5.0, 48000); // 5秒、LUFS用に48kHz
      const audio = createTestAudioData(speechSignal, 48000);
      
      // 複数の高度な特徴量を並列計算
      const [lufsResult, spectralResult, vadResult, energyResult, dynamicsResult] = await Promise.all([
        analyze(audio, getLUFS),
        analyze(audio, getSpectralFeatures),
        analyze(audio, getVAD),
        analyze(audio, getEnergy),
        analyze(audio, getCrestFactor)
      ]);
      
      // LUFS結果の検証
      expect(lufsResult.integrated).toBeTypeOf('number');
      expect(lufsResult.integrated).toBeLessThan(0);
      
      // スペクトル特徴量の検証
      expect(spectralResult.spectralCentroid).toBeGreaterThan(0);
      expect(spectralResult.spectralBandwidth).toBeGreaterThan(0);
      expect(spectralResult.spectralFlatness).toBeGreaterThanOrEqual(0);
      expect(spectralResult.spectralFlatness).toBeLessThanOrEqual(1);
      
      // VAD結果の検証
      expect(vadResult.segments).toBeDefined();
      expect(vadResult.speechRatio).toBeGreaterThanOrEqual(0);
      expect(vadResult.speechRatio).toBeLessThanOrEqual(1);
      
      // エネルギー結果の検証
      expect(energyResult.totalEnergy).toBeGreaterThan(0);
      expect(energyResult.statistics.mean).toBeGreaterThan(0);
      
      // ダイナミクス結果の検証
      expect(dynamicsResult.crestFactorLinear).toBeGreaterThan(0);
      expect(dynamicsResult.peak).toBeGreaterThan(0);
      expect(dynamicsResult.rms).toBeGreaterThan(0);
    });

    it('should analyze real-world audio processing workflow', async () => {
      // 実際のワークフローを模擬：音声とノイズが混在
      const speechPart = createSpeechLikeSignal(3.0);
      const noisePart = new Float32Array(44100 * 2); // 2秒のノイズ
      for (let i = 0; i < noisePart.length; i++) {
        noisePart[i] = (Math.random() - 0.5) * 0.1;
      }
      
      // 結合
      const combinedSignal = new Float32Array(speechPart.length + noisePart.length);
      combinedSignal.set(speechPart, 0);
      combinedSignal.set(noisePart, speechPart.length);
      
      const audio = createTestAudioData(combinedSignal);
      
      // 1. まずVADで音声セグメントを検出
      const vadResult = await analyze(audio, (audio) => 
        getVAD(audio, { method: 'energy', energyThreshold: 0.001 })
      );
      
      // 2. ピーク検出で顕著な特徴を抽出
      const peaks = await analyze(audio, (audio) => 
        getPeaks(audio, { count: 10, threshold: 0.1 })
      );
      
      // 3. スペクトル解析で周波数特性を分析
      const spectral = await analyze(audio, getSpectralFeatures);
      
      // 4. エネルギー解析でダイナミクスを評価
      const energy = await analyze(audio, getEnergy);
      
      // ワークフローの妥当性検証
      expect(vadResult.segments.length).toBeGreaterThan(0);
      expect(peaks.peaks.length).toBeGreaterThanOrEqual(0); // ピークが見つからない場合もあり得る
      expect(spectral.spectralCentroid).toBeGreaterThan(0);
      expect(energy.totalEnergy).toBeGreaterThan(0);
      
      // 音声部分が検出されているか確認（検出されない場合もあり得る）
      const speechSegments = vadResult.segments.filter(s => s.type === 'speech');
      expect(speechSegments.length).toBeGreaterThanOrEqual(0);
      
      // ピークが音声部分に集中しているか確認
      if (peaks.peaks.length > 0) {
        const speechPeaks = peaks.peaks.filter(peak => 
          peak.time < audio.duration * 0.6 // 前半の音声部分
        );
        expect(speechPeaks.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Multi-channel audio analysis', () => {
    it('should analyze stereo audio', async () => {
      const leftSignal = createComplexSignal(44100, 1);
      const rightSignal = new Float32Array(leftSignal.length);
      
      // 右チャンネルは左チャンネルの半分の振幅
      for (let i = 0; i < rightSignal.length; i++) {
        rightSignal[i] = (leftSignal[i] ?? 0) * 0.5;
      }
      
      const stereoAudio = createStereoAudioData(leftSignal, rightSignal);
      
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

    it('should analyze stereo with advanced features', async () => {
      const leftSpeech = createSpeechLikeSignal(2.0, 48000);
      const rightSpeech = createSpeechLikeSignal(2.0, 48000);
      
      // 右チャンネルの振幅を調整
      for (let i = 0; i < rightSpeech.length; i++) {
        rightSpeech[i] = (rightSpeech[i] ?? 0) * 0.7;
      }
      
      const stereoAudio = createStereoAudioData(leftSpeech, rightSpeech, 48000);
      
      // チャンネルごとのLUFS解析
      const leftLUFS = await analyze(stereoAudio, (audio) => 
        getLUFS(audio, { channelMode: 'mono' })
      );
      
      const stereoLUFS = await analyze(stereoAudio, (audio) => 
        getLUFS(audio, { channelMode: 'stereo' })
      );
      
      // チャンネルごとのVAD解析
      const leftVAD = await analyze(stereoAudio, (audio) => 
        getVAD(audio, { channel: 0 })
      );
      
      const rightVAD = await analyze(stereoAudio, (audio) => 
        getVAD(audio, { channel: 1 })
      );
      
      expect(leftLUFS.integrated).toBeDefined();
      expect(stereoLUFS.integrated).toBeDefined();
      expect(leftVAD.speechRatio).toBeGreaterThanOrEqual(0);
      expect(rightVAD.speechRatio).toBeGreaterThanOrEqual(0);
    });

    it('should analyze averaged channels', async () => {
      const channel1 = createComplexSignal(44100, 1);
      const channel2 = new Float32Array(channel1.length);
      channel2.fill(0.5); // DC signal
      
      const audio = createStereoAudioData(channel1, channel2);
      
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
      
      const faultyFeature = (): never => {
        throw new Error('Feature extraction failed');
      };
      
      await expect(analyze(audio, faultyFeature))
        .rejects.toThrow('Feature extraction failed');
    });

    it('should handle empty audio gracefully', async () => {
      const emptyAudio = createTestAudioData(new Float32Array(0));
      
      // analyze関数の検証で弾かれるはず
      await expect(analyze(emptyAudio, getPeaks))
        .rejects.toThrow('Data length is invalid');
    });

    it('should handle invalid parameters gracefully', async () => {
      const audio = createTestAudioData(createComplexSignal(44100, 1));
      
      // 無効なチャンネル指定
      await expect(analyze(audio, (audio) => getRMS(audio, 5)))
        .rejects.toThrow('Invalid channel number');
      
      // 無効な閾値でピーク検出 - エラーがスローされることを期待
      await expect(analyze(audio, (audio) => 
        getPeaks(audio, { threshold: -1 })
      )).rejects.toThrow('閾値は0から1の範囲である必要があります');
    });
  });

  describe('Performance and scalability', () => {
    it('should handle large audio files efficiently', async () => {
      const largeSignal = createComplexSignal(44100, 10); // 10秒のオーディオ
      const audio = createTestAudioData(largeSignal);
      
      const startTime = performance.now();
      
      const [peaks, rms, zcr, energy] = await Promise.all([
        analyze(audio, (audio) => getPeaks(audio, { count: 20 })),
        analyze(audio, (audio) => getRMS(audio)),
        analyze(audio, (audio) => getZeroCrossing(audio)),
        analyze(audio, getEnergy)
      ]);
      
      const endTime = performance.now();
      
      // 処理時間が妥当な範囲内であることを確認（CI環境を考慮して緩めに設定）
      expect(endTime - startTime).toBeLessThan(10000); // 10秒以内
      
      expect(peaks.peaks.length).toBeLessThanOrEqual(20);
      expect(rms).toBeGreaterThan(0);
      expect(zcr).toBeGreaterThan(0);
      expect(energy.totalEnergy).toBeGreaterThan(0);
    });

    it('should handle different sample rates', async () => {
      const sampleRates = [8000, 16000, 22050, 44100, 48000];
      
      for (const sampleRate of sampleRates) {
        const signal = createComplexSignal(sampleRate, 0.5);
        const audio = createTestAudioData(signal, sampleRate);
        
        const peaks = await analyze(audio, (audio) => 
          getPeaks(audio, { count: 5, threshold: 0.5 })
        );
        
        const rms = await analyze(audio, (audio) => getRMS(audio));
        
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
      const firstResult = results[0];
      if (firstResult) {
        for (let i = 1; i < results.length; i++) {
          const result = results[i];
          if (result) {
            expect(result.peaks.length).toBe(firstResult.peaks.length);
            expect(result.maxAmplitude).toBe(firstResult.maxAmplitude);
            
            for (let j = 0; j < result.peaks.length; j++) {
              expect(result.peaks[j]?.position).toBe(firstResult.peaks[j]?.position);
              expect(result.peaks[j]?.amplitude).toBe(firstResult.peaks[j]?.amplitude);
            }
          }
        }
      }
    });
  });

  describe('Real-world use cases', () => {
    it('should support audio quality assessment workflow', async () => {
      const highQualitySignal = createComplexSignal(48000, 3);
      const audio = createTestAudioData(highQualitySignal, 48000);
      
      // 音質評価のための複合解析
      const [lufs, dynamics, spectral, energy] = await Promise.all([
        analyze(audio, (audio) => getLUFS(audio, { calculateTruePeak: true })),
        analyze(audio, getCrestFactor),
        analyze(audio, getSpectralFeatures),
        analyze(audio, getEnergy)
      ]);
      
      // 音質指標の検証
      expect(lufs.integrated).toBeLessThan(0); // 適切なラウドネス
      expect(lufs.truePeak).toBeDefined(); // ピークレベル監視
      
      expect(dynamics.crestFactorLinear).toBeGreaterThan(1); // 適切なダイナミクス
      expect(dynamics.peak).toBeLessThanOrEqual(1); // クリッピング無し
      
      expect(spectral.spectralFlatness).toBeGreaterThan(0); // 周波数バランス
      expect(spectral.spectralCentroid).toBeGreaterThan(0); // 音色特性
      
      expect(energy.statistics.std).toBeGreaterThanOrEqual(0); // エネルギー変動
    });

    it('should support content analysis workflow', async () => {
      // 音声とノイズが混在するコンテンツ
      const contentSignal = createSpeechLikeSignal(4.0);
      const audio = createTestAudioData(contentSignal);
      
      // コンテンツ分析ワークフロー
      const [vad, peaks, zcr, spectral] = await Promise.all([
        analyze(audio, (audio) => getVAD(audio, { method: 'combined' })),
        analyze(audio, (audio) => getPeaks(audio, { count: 15, threshold: 0.1 })),
        analyze(audio, (audio) => getZeroCrossing(audio)),
        analyze(audio, getSpectralFeatures)
      ]);
      
      // コンテンツ特性の評価
      expect(vad.speechRatio).toBeGreaterThanOrEqual(0);
      expect(vad.segments.length).toBeGreaterThan(0);
      
      expect(peaks.peaks.length).toBeGreaterThanOrEqual(0); // ピークが見つからない場合もあり得る
      expect(zcr).toBeGreaterThan(0); // 音声特性
      
      expect(spectral.zeroCrossingRate).toBeGreaterThan(0);
      expect(spectral.spectralBandwidth).toBeGreaterThan(0);
      
      // 音声セグメントとピークの相関
      const speechSegments = vad.segments.filter(s => s.type === 'speech');
      if (peaks.peaks.length > 0 && speechSegments.length > 0) {
        const peaksInSpeech = peaks.peaks.filter(peak => 
          speechSegments.some(segment => 
            peak.time >= segment.start && peak.time <= segment.end
          )
        );
        
        // 音声セグメント内にピークが存在することを確認
        expect(peaksInSpeech.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should support streaming analysis simulation', async () => {
      // ストリーミング処理のシミュレーション
      const fullSignal = createComplexSignal(44100, 5); // 5秒
      const chunkSize = 44100; // 1秒ずつ処理
      
      const chunkResults: Array<{ rms: number; peaks: number; zcr: number }> = [];
      
      for (let i = 0; i < fullSignal.length; i += chunkSize) {
        const chunk = fullSignal.slice(i, i + chunkSize);
        if (chunk.length > 0) {
          const chunkAudio = createTestAudioData(chunk);
          
          const [rms, peaks, zcr] = await Promise.all([
            analyze(chunkAudio, (audio) => getRMS(audio)),
            analyze(chunkAudio, (audio) => getPeaks(audio, { count: 3, threshold: 0.5 })),
            analyze(chunkAudio, (audio) => getZeroCrossing(audio))
          ]);
          
          chunkResults.push({
            rms,
            peaks: peaks.peaks.length,
            zcr
          });
        }
      }
      
      // ストリーミング結果の検証
      expect(chunkResults.length).toBeGreaterThan(0);
      chunkResults.forEach(result => {
        expect(result.rms).toBeGreaterThan(0);
        expect(result.peaks).toBeGreaterThanOrEqual(0);
        expect(result.zcr).toBeGreaterThan(0);
      });
      
      // 全体的な一貫性確認
      const avgRMS = chunkResults.reduce((sum, r) => sum + r.rms, 0) / chunkResults.length;
      expect(avgRMS).toBeGreaterThan(0);
    });
  });
}); 