import { describe, it, expect, beforeAll } from 'vitest';
import { performance } from 'perf_hooks';
import {
  getRMS,
  getPeak,
  getZeroCrossing,
  getCrestFactor,
  getSpectrum,
  getSpectralFeatures,
  getTimeVaryingSpectralFeatures,
  getSpectralEntropy,
  getSpectralCrest,
  getMFCC,
  getEnergy,
  getStereoAnalysis,
  getVAD,
  getLUFS,
  getLUFSRealtime,
  stft,
  istft,
  analyzeAll
} from '../src/index.js';
import type { AudioData } from '../src/types.js';

// テスト信号生成
function generateTestSignal(duration: number, sampleRate: number): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const signal = new Float32Array(length);
  
  // 複数の周波数成分
  const frequencies = [440, 880, 1320, 1760, 2200];
  const amplitudes = [1, 0.5, 0.3, 0.2, 0.1];
  
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const value = frequencies.reduce((sum, freq, idx) => {
      return sum + (amplitudes[idx] ?? 0) * Math.sin(2 * Math.PI * freq * t);
    }, 0) * 0.2;
    
    // ノイズ追加
    signal[i] = value + (Math.random() - 0.5) * 0.01;
  }
  
  return signal;
}

describe('Performance Tests', () => {
  let testData: Map<number, AudioData>;
  
  beforeAll(() => {
    // テストデータを事前に生成
    testData = new Map();
    const durations = [0.1, 0.5, 1.0, 5.0];
    const sampleRate = 48000;
    
    durations.forEach(duration => {
      const signal = generateTestSignal(duration, sampleRate);
      testData.set(duration, {
        sampleRate,
        channelData: [signal],
        duration,
        numberOfChannels: 1,
        length: signal.length
      });
    });
  });

  describe('時間領域解析', () => {
    it('should process RMS efficiently', () => {
      const audio = testData.get(1.0)!;
      const start = performance.now();
      
      getRMS(audio);
      
      const elapsed = performance.now() - start;
      console.log(`RMS (1秒): ${elapsed.toFixed(2)}ms`);
      
      // 1秒の音声を10ms以内に処理
      expect(elapsed).toBeLessThan(10);
    });

    it('should process multiple time-domain features efficiently', () => {
      const audio = testData.get(5.0)!;
      const start = performance.now();
      
      getRMS(audio);
      getPeak(audio);
      getZeroCrossing(audio);
      getCrestFactor(audio);
      
      const elapsed = performance.now() - start;
      console.log(`時間領域特徴量4つ (5秒): ${elapsed.toFixed(2)}ms`);
      
      // 5秒の音声を200ms以内に処理
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('周波数領域解析', () => {
    it('should process spectrum efficiently', () => {
      const audio = testData.get(1.0)!;
      const start = performance.now();
      
      getSpectrum(audio, { fftSize: 2048 });
      
      const elapsed = performance.now() - start;
      console.log(`Spectrum (1秒): ${elapsed.toFixed(2)}ms`);
      
      // 1秒の音声を20ms以内に処理
      expect(elapsed).toBeLessThan(20);
    });

    it('should process MFCC efficiently', () => {
      const audio = testData.get(0.5)!;
      const start = performance.now();
      
      getMFCC(audio, { 
        fftSize: 2048,
        hopSizeMs: 10,
        numMfccCoeffs: 13,
        numMelFilters: 40
      });
      
      const elapsed = performance.now() - start;
      console.log(`MFCC (0.5秒): ${elapsed.toFixed(2)}ms`);
      
      // 0.5秒の音声を100ms以内に処理
      expect(elapsed).toBeLessThan(100);
    });

    it('should process spectral features efficiently', () => {
      const audio = testData.get(1.0)!;
      const start = performance.now();
      
      getSpectralFeatures(audio, { fftSize: 2048 });
      
      const elapsed = performance.now() - start;
      console.log(`Spectral Features (1秒): ${elapsed.toFixed(2)}ms`);
      
      // 1秒の音声を50ms以内に処理
      expect(elapsed).toBeLessThan(50);
    });

    it('should process spectral entropy efficiently', () => {
      const audio = testData.get(1.0)!;
      const start = performance.now();
      
      getSpectralEntropy(audio, { fftSize: 2048 });
      
      const elapsed = performance.now() - start;
      console.log(`Spectral Entropy (1秒): ${elapsed.toFixed(2)}ms`);
      
      // 1秒の音声を20ms以内に処理
      expect(elapsed).toBeLessThan(20);
    });

    it('should process spectral crest efficiently', () => {
      const audio = testData.get(1.0)!;
      const start = performance.now();
      
      getSpectralCrest(audio, { fftSize: 2048 });
      
      const elapsed = performance.now() - start;
      console.log(`Spectral Crest (1秒): ${elapsed.toFixed(2)}ms`);
      
      // 1秒の音声を20ms以内に処理
      expect(elapsed).toBeLessThan(20);
    });
  });

  describe('STFT/iSTFT', () => {
    it('should perform STFT efficiently', () => {
      const signal = generateTestSignal(1.0, 48000);
      const start = performance.now();
      
      const result = stft(signal, 48000, {
        fftSize: 2048,
        windowType: 'hann',
        hopSize: 512
      });
      
      const elapsed = performance.now() - start;
      console.log(`STFT (1秒, ${result.frameCount}フレーム): ${elapsed.toFixed(2)}ms`);
      
      // 1秒の音声を150ms以内に処理
      expect(elapsed).toBeLessThan(150);
    });

    it('should achieve perfect reconstruction efficiently', () => {
      const signal = generateTestSignal(1.0, 48000);
      
      const stftStart = performance.now();
      const stftResult = stft(signal, 48000, {
        fftSize: 2048,
        windowType: 'hann',
        hopSize: 512
      });
      const stftElapsed = performance.now() - stftStart;
      
      const istftStart = performance.now();
      const reconstructed = istft(stftResult, 48000, {
        fftSize: 2048,
        windowType: 'hann',
        hopSize: 512
      }, signal.length);
      const istftElapsed = performance.now() - istftStart;
      
      console.log(`STFT: ${stftElapsed.toFixed(2)}ms, iSTFT: ${istftElapsed.toFixed(2)}ms`);
      
      // 再構成誤差の確認
      let mse = 0;
      const start = 1024;
      const end = signal.length - 1024;
      for (let i = start; i < end; i++) {
        const diff = (signal[i] ?? 0) - (reconstructed[i] ?? 0);
        mse += diff * diff;
      }
      mse /= (end - start);
      const snr = 10 * Math.log10(1 / mse);
      
      console.log(`再構成SNR: ${snr.toFixed(1)}dB`);
      
      // 高速かつ高精度
      expect(stftElapsed + istftElapsed).toBeLessThan(200);
      expect(snr).toBeGreaterThan(100); // 100dB以上の高精度
    });
  });

  describe('エネルギー解析', () => {
    it('should process energy analysis efficiently', () => {
      const audio = testData.get(1.0)!;
      const start = performance.now();
      
      getEnergy(audio, { frameSize: 1024, hopSize: 512 });
      
      const elapsed = performance.now() - start;
      console.log(`Energy (1秒): ${elapsed.toFixed(2)}ms`);
      
      // 1秒の音声を50ms以内に処理
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('ステレオ解析', () => {
    it('should process stereo analysis efficiently', () => {
      // ステレオ信号を作成
      const signal1 = generateTestSignal(1.0, 48000);
      const signal2 = generateTestSignal(1.0, 48000);
      // 位相をずらす
      for (let i = 0; i < signal2.length; i++) {
        signal2[i] = (signal2[i] ?? 0) * 0.8 + (signal1[i] ?? 0) * 0.2;
      }
      
      const stereoAudio: AudioData = {
        sampleRate: 48000,
        channelData: [signal1, signal2],
        duration: 1.0,
        numberOfChannels: 2,
        length: signal1.length
      };
      
      const start = performance.now();
      getStereoAnalysis(stereoAudio, {
        // 基本解析のみ（高速）
        calculatePhase: false,
        calculateITD: false,
        calculateILD: false
        // frameSizeはデフォルト（Math.min(8192, audio.length)）を使用
      });
      const elapsed = performance.now() - start;
      
      console.log(`Stereo Analysis (1秒): ${elapsed.toFixed(2)}ms`);
      
      // 1秒のステレオ音声を50ms以内に処理（基本解析）
      expect(elapsed).toBeLessThan(50);
    });

    it('should process advanced stereo analysis efficiently', () => {
      // ステレオ信号を作成
      const signal1 = generateTestSignal(1.0, 48000);
      const signal2 = generateTestSignal(1.0, 48000);
      // 位相をずらす
      for (let i = 0; i < signal2.length; i++) {
        signal2[i] = (signal2[i] ?? 0) * 0.8 + (signal1[i] ?? 0) * 0.2;
      }
      
      const stereoAudio: AudioData = {
        sampleRate: 48000,
        channelData: [signal1, signal2],
        duration: 1.0,
        numberOfChannels: 2,
        length: signal1.length
      };
      
      const start = performance.now();
      getStereoAnalysis(stereoAudio, {
        // 高度な解析を含む
        calculatePhase: true,
        calculateITD: true,
        calculateILD: true
        // frameSizeはデフォルト（Math.min(8192, audio.length)）を使用
      });
      const elapsed = performance.now() - start;
      
      console.log(`Advanced Stereo Analysis (1秒): ${elapsed.toFixed(2)}ms`);
      
      // 1秒のステレオ音声を150ms以内に処理（高度な解析）
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe('VAD（音声区間検出）', () => {
    it('should process VAD efficiently', () => {
      const audio = testData.get(5.0)!;
      const start = performance.now();
      
      getVAD(audio, { 
        frameSizeMs: 30,
        hopSizeMs: 10,
        energyThreshold: 0.01
      });
      
      const elapsed = performance.now() - start;
      console.log(`VAD (5秒): ${elapsed.toFixed(2)}ms`);
      
      // 5秒の音声を300ms以内に処理
      expect(elapsed).toBeLessThan(300);
    });
  });

  describe('ラウドネス解析', () => {
    it('should calculate LUFS efficiently', () => {
      const audio = testData.get(5.0)!;
      const start = performance.now();
      
      const result = getLUFS(audio, { gated: true });
      
      const elapsed = performance.now() - start;
      console.log(`LUFS Integrated (5秒): ${elapsed.toFixed(2)}ms, 値: ${result.integrated.toFixed(1)} LUFS`);
      
      // 5秒の音声を200ms以内に処理
      expect(elapsed).toBeLessThan(200);
    });

    it('should process realtime LUFS efficiently', () => {
      const processor = getLUFSRealtime(48000, { channelMode: 'mono' });
      const signal = generateTestSignal(10.0, 48000);
      const chunkSize = 4800; // 100ms
      
      const start = performance.now();
      let lastResult;
      
      for (let i = 0; i < signal.length; i += chunkSize) {
        const chunk = signal.subarray(i, Math.min(i + chunkSize, signal.length));
        lastResult = processor.process([chunk]);
      }
      
      const elapsed = performance.now() - start;
      const realtimeRatio = 10000 / elapsed;
      
      console.log(`Realtime LUFS (10秒): ${elapsed.toFixed(2)}ms (${realtimeRatio.toFixed(1)}x リアルタイム)`);
      console.log(`最終値: Integrated=${lastResult?.integrated.toFixed(1)}, Momentary=${lastResult?.momentary.toFixed(1)}, Short-term=${lastResult?.shortTerm.toFixed(1)} LUFS`);
      
      // 15x以上のリアルタイム処理速度
      expect(realtimeRatio).toBeGreaterThan(15);
    });
  });

  describe('バッチ処理', () => {
    it('should process batch analysis efficiently', async () => {
      const audio = testData.get(1.0)!;
      const start = performance.now();
      
      const result = await analyzeAll(audio, {
        waveform: {
          framesPerSecond: 50,
          channel: 0
        },
        peaks: {
          count: 10,
          threshold: 0.1
        },
        rms: {
          channel: 0
        },
        spectrum: {
          fftSize: 2048
        },
        energy: {
          windowSizeMs: 20,
          hopSizeMs: 10
        }
      });
      
      const elapsed = performance.now() - start;
      const features = Object.keys(result).length;
      
      console.log(`バッチ解析 (1秒, ${features}特徴量): ${elapsed.toFixed(2)}ms`);
      
      // 1秒の音声を300ms以内に全特徴量計算
      expect(elapsed).toBeLessThan(300);
      expect(features).toBeGreaterThan(1);
    });
  });

  describe('時間変化特徴量', () => {
    it('should process time-varying spectral features efficiently', () => {
      const audio = testData.get(1.0)!;
      const start = performance.now();
      
      getTimeVaryingSpectralFeatures(audio, { 
        fftSize: 2048,
        hopSize: 512
      });
      
      const elapsed = performance.now() - start;
      console.log(`Time-Varying Spectral Features (1秒): ${elapsed.toFixed(2)}ms`);
      
      // 1秒の音声を100ms以内に処理
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('スケーラビリティテスト', () => {
    it('should scale linearly with audio length', () => {
      const measurements: Array<{ duration: number; time: number }> = [];
      
      [0.1, 0.5, 1.0, 5.0].forEach(duration => {
        const audio = testData.get(duration)!;
        const start = performance.now();
        
        getRMS(audio);
        getSpectrum(audio, { fftSize: 2048 });
        
        const elapsed = performance.now() - start;
        measurements.push({ duration, time: elapsed });
      });
      
      console.log('\nスケーラビリティ (RMS + Spectrum):');
      measurements.forEach(m => {
        console.log(`  ${m.duration}秒: ${m.time.toFixed(2)}ms (${(m.time / m.duration).toFixed(2)}ms/秒)`);
      });
      
      // 線形に近いスケーリング（処理時間/秒が一定に近い）
      const timesPerSecond = measurements.map(m => m.time / m.duration);
      const avgTimePerSecond = timesPerSecond.reduce((a, b) => a + b) / timesPerSecond.length;
      
      timesPerSecond.forEach(t => {
        const deviation = Math.abs(t - avgTimePerSecond) / avgTimePerSecond;
        expect(deviation).toBeLessThan(1.0); // 100%以内の偏差
      });
    });
  });

  describe('メモリ効率', () => {
    it('should handle large audio files efficiently', () => {
      // 60秒の音声データ
      const longSignal = generateTestSignal(60.0, 48000);
      const audio: AudioData = {
        sampleRate: 48000,
        channelData: [longSignal],
        duration: 60.0,
        numberOfChannels: 1,
        length: longSignal.length
      };
      
      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      
      const start = performance.now();
      getRMS(audio);
      getSpectrum(audio, { fftSize: 4096 });
      const elapsed = performance.now() - start;
      
      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`\n60秒音声の処理:`);
      console.log(`  処理時間: ${elapsed.toFixed(2)}ms`);
      console.log(`  メモリ増加: ${memoryIncrease.toFixed(2)}MB`);
      
      // 60秒の音声を1秒以内に処理
      expect(elapsed).toBeLessThan(1000);
      // メモリ増加が100MB以内
      expect(memoryIncrease).toBeLessThan(100);
    });
  });
});