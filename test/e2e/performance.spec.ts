import { test, expect } from '@playwright/test';

// テスト用の音声データ生成
function generateTestSignal(duration: number, sampleRate: number): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const signal = new Float32Array(length);

  // 複数の周波数成分を含む複雑な信号
  const frequencies = [440, 880, 1320, 1760, 2200];
  const amplitudes = [1, 0.5, 0.3, 0.2, 0.1];

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    signal[i] =
      frequencies.reduce((sum, freq, idx) => {
        return sum + amplitudes[idx] * Math.sin(2 * Math.PI * freq * t);
      }, 0) * 0.2; // 全体の振幅を調整

    // ノイズを追加
    signal[i] += (Math.random() - 0.5) * 0.01;
  }

  return signal;
}

test.describe('Audio Analysis Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // generateTestSignal関数とライブラリの初期化をまとめて実行
    await page.goto('/test-page.html');

    await page.evaluate(async () => {
      // generateTestSignal関数を定義
      (window as any).generateTestSignal = function (
        duration: number,
        sampleRate: number
      ): Float32Array {
        const length = Math.floor(duration * sampleRate);
        const signal = new Float32Array(length);

        const frequencies = [440, 880, 1320, 1760, 2200];
        const amplitudes = [1, 0.5, 0.3, 0.2, 0.1];

        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          signal[i] =
            frequencies.reduce((sum, freq, idx) => {
              return sum + amplitudes[idx] * Math.sin(2 * Math.PI * freq * t);
            }, 0) * 0.2;

          signal[i] += (Math.random() - 0.5) * 0.01;
        }

        return signal;
      };

      // AudioInspectライブラリをロード
      try {
        // @ts-ignore
        const module = await import('/index.js');
        // @ts-ignore
        window.AudioInspect = module;
        console.log('AudioInspectライブラリがロードされました:', Object.keys(module));
      } catch (error) {
        console.error('ライブラリの読み込みに失敗しました:', error);
        throw error;
      }
    });

    // ライブラリと関数が使用可能になるまで待機
    await page.waitForFunction(
      () => {
        return (
          typeof (window as any).AudioInspect !== 'undefined' &&
          typeof (window as any).generateTestSignal !== 'undefined'
        );
      },
      { timeout: 30000 }
    );
  });

  test('時間領域解析のパフォーマンス測定', async ({ page }) => {
    const results = await page.evaluate(async () => {
      // @ts-ignore
      const { getRMS, getPeakAmplitude, getZeroCrossing, getCrestFactor } = window.AudioInspect;

      const durations = [0.1, 0.5, 1.0, 5.0]; // 秒
      const sampleRate = 48000;
      const metrics: any[] = [];

      for (const duration of durations) {
        const signal = window.generateTestSignal(duration, sampleRate);
        const audio = {
          sampleRate,
          channelData: [signal],
          duration,
          numberOfChannels: 1,
          length: signal.length
        };

        // RMS
        const rmsStart = performance.now();
        getRMS(audio, { windowSize: 1024, hopSize: 512 });
        const rmsTime = performance.now() - rmsStart;

        // Peak Level
        const peakStart = performance.now();
        getPeakAmplitude(audio, { channel: 0 });
        const peakTime = performance.now() - peakStart;

        // Zero Crossing Rate
        const zcrStart = performance.now();
        getZeroCrossing(audio, 0);
        const zcrTime = performance.now() - zcrStart;

        // Crest Factor
        const crestStart = performance.now();
        getCrestFactor(audio, { windowSize: 1024, hopSize: 512 });
        const crestTime = performance.now() - crestStart;

        metrics.push({
          duration,
          samples: signal.length,
          rmsTime,
          peakTime,
          zcrTime,
          crestTime,
          totalTime: rmsTime + peakTime + zcrTime + crestTime
        });
      }

      return metrics;
    });

    console.log('時間領域解析パフォーマンス:');
    results.forEach((r) => {
      console.log(`${r.duration}秒 (${r.samples}サンプル):`);
      console.log(`  RMS: ${r.rmsTime.toFixed(2)}ms`);
      console.log(`  Peak: ${r.peakTime.toFixed(2)}ms`);
      console.log(`  ZCR: ${r.zcrTime.toFixed(2)}ms`);
      console.log(`  Crest: ${r.crestTime.toFixed(2)}ms`);
      console.log(`  合計: ${r.totalTime.toFixed(2)}ms`);
      console.log(`  処理速度: ${((r.duration * 1000) / r.totalTime).toFixed(1)}x リアルタイム`);
    });

    // パフォーマンス基準: 5秒の音声を100ms以内に処理
    const longAudioResult = results.find((r) => r.duration === 5.0);
    expect(longAudioResult.totalTime).toBeLessThan(100);
  });

  test('周波数領域解析のパフォーマンス測定', async ({ page }) => {
    const results = await page.evaluate(async () => {
      // @ts-ignore
      const { getSpectrum, getSpectralFeatures, getMFCC } = window.AudioInspect;

      const durations = [0.1, 0.5, 1.0, 5.0];
      const sampleRate = 48000;
      const metrics: any[] = [];

      for (const duration of durations) {
        const signal = window.generateTestSignal(duration, sampleRate);
        const audio = {
          sampleRate,
          channelData: [signal],
          duration,
          numberOfChannels: 1,
          length: signal.length
        };

        // Spectrum
        const spectrumStart = performance.now();
        await getSpectrum(audio, { fftSize: 2048 });
        const spectrumTime = performance.now() - spectrumStart;

        // Spectral Features
        const spectralStart = performance.now();
        await getSpectralFeatures(audio, { fftSize: 2048 });
        const spectralTime = performance.now() - spectralStart;

        // MFCC (計算量が多い)
        const mfccStart = performance.now();
        await getMFCC(audio, {
          fftSize: 2048,
          numMfccCoeffs: 13,
          numMelFilters: 40
        });
        const mfccTime = performance.now() - mfccStart;

        metrics.push({
          duration,
          samples: signal.length,
          spectrumTime,
          spectralTime,
          mfccTime,
          totalTime: spectrumTime + spectralTime + mfccTime
        });
      }

      return metrics;
    });

    console.log('\n周波数領域解析パフォーマンス:');
    results.forEach((r) => {
      console.log(`${r.duration}秒 (${r.samples}サンプル):`);
      console.log(`  Spectrum: ${r.spectrumTime.toFixed(2)}ms`);
      console.log(`  Spectral Features: ${r.spectralTime.toFixed(2)}ms`);
      console.log(`  MFCC: ${r.mfccTime.toFixed(2)}ms`);
      console.log(`  合計: ${r.totalTime.toFixed(2)}ms`);
      console.log(`  処理速度: ${((r.duration * 1000) / r.totalTime).toFixed(1)}x リアルタイム`);
    });

    // パフォーマンス基準: 5秒の音声を500ms以内に処理
    const longAudioResult = results.find((r) => r.duration === 5.0);
    expect(longAudioResult.totalTime).toBeLessThan(500);
  });

  test('STFT/iSTFTのパフォーマンス測定', async ({ page }) => {
    const results = await page.evaluate(async () => {
      // @ts-ignore
      const { stft, istft } = window.AudioInspect;

      const durations = [0.1, 0.5, 1.0, 5.0];
      const sampleRate = 48000;
      const metrics: any[] = [];

      for (const duration of durations) {
        const signal = window.generateTestSignal(duration, sampleRate);

        // STFT
        const stftStart = performance.now();
        const stftResult = stft(signal, sampleRate, {
          fftSize: 2048,
          windowType: 'hann',
          hopSize: 512
        });
        const stftTime = performance.now() - stftStart;

        // iSTFT
        const istftStart = performance.now();
        const reconstructed = istft(
          stftResult,
          sampleRate,
          {
            fftSize: 2048,
            windowType: 'hann',
            hopSize: 512
          },
          signal.length
        );
        const istftTime = performance.now() - istftStart;

        // 再構成誤差の計算
        let mse = 0;
        const start = 1024;
        const end = signal.length - 1024;
        for (let i = start; i < end; i++) {
          const diff = signal[i] - reconstructed[i];
          mse += diff * diff;
        }
        mse /= end - start;
        const snr = 10 * Math.log10(1 / mse);

        metrics.push({
          duration,
          samples: signal.length,
          frames: stftResult.frameCount,
          stftTime,
          istftTime,
          totalTime: stftTime + istftTime,
          reconstructionSNR: snr
        });
      }

      return metrics;
    });

    console.log('\nSTFT/iSTFTパフォーマンス:');
    results.forEach((r) => {
      console.log(`${r.duration}秒 (${r.samples}サンプル, ${r.frames}フレーム):`);
      console.log(`  STFT: ${r.stftTime.toFixed(2)}ms`);
      console.log(`  iSTFT: ${r.istftTime.toFixed(2)}ms`);
      console.log(`  合計: ${r.totalTime.toFixed(2)}ms`);
      console.log(`  処理速度: ${((r.duration * 1000) / r.totalTime).toFixed(1)}x リアルタイム`);
      console.log(`  再構成SNR: ${r.reconstructionSNR.toFixed(1)}dB`);
    });

    // パフォーマンス基準
    const longAudioResult = results.find((r) => r.duration === 5.0);
    expect(longAudioResult.totalTime).toBeLessThan(200); // 5秒を200ms以内
    expect(longAudioResult.reconstructionSNR).toBeGreaterThan(50); // 50dB以上のSNR
  });

  test('ラウドネス解析のパフォーマンス測定', async ({ page }) => {
    const results = await page.evaluate(async () => {
      const { getLUFS, getLUFSRealtime } = window.AudioInspect;

      const durations = [0.5, 1.0, 5.0, 10.0]; // 短い音声は除外（LUFS計算には最低400ms必要）
      const sampleRate = 48000;
      const metrics: any[] = [];

      for (const duration of durations) {
        const signal = window.generateTestSignal(duration, sampleRate);
        const audio = {
          sampleRate,
          channelData: [signal],
          duration,
          numberOfChannels: 1,
          length: signal.length
        };

        // Integrated LUFS
        const integratedStart = performance.now();
        const lufsResult = getLUFS(audio, { gated: true });
        const integratedTime = performance.now() - integratedStart;

        // Momentary + Short-term
        const momentaryStart = performance.now();
        getLUFS(audio, {
          calculateMomentary: true,
          calculateShortTerm: true
        });
        const momentaryTime = performance.now() - momentaryStart;

        // リアルタイム処理のシミュレーション
        const processor = getLUFSRealtime(sampleRate, { channelMode: 'mono' });
        const chunkSize = 4800; // 100ms
        const realtimeStart = performance.now();

        for (let i = 0; i < signal.length; i += chunkSize) {
          const chunk = signal.subarray(i, Math.min(i + chunkSize, signal.length));
          processor.process([chunk]);
        }

        const realtimeTime = performance.now() - realtimeStart;

        metrics.push({
          duration,
          samples: signal.length,
          integratedTime,
          momentaryTime,
          realtimeTime,
          integratedLUFS: lufsResult.integrated
        });
      }

      return metrics;
    });

    console.log('\nラウドネス解析パフォーマンス:');
    results.forEach((r) => {
      console.log(`${r.duration}秒 (${r.samples}サンプル):`);
      console.log(`  Integrated: ${r.integratedTime.toFixed(2)}ms`);
      console.log(`  Momentary/Short-term: ${r.momentaryTime.toFixed(2)}ms`);
      console.log(`  リアルタイム処理: ${r.realtimeTime.toFixed(2)}ms`);
      console.log(`  処理速度: ${((r.duration * 1000) / r.realtimeTime).toFixed(1)}x リアルタイム`);
      console.log(`  測定値: ${r.integratedLUFS.toFixed(1)} LUFS`);
    });

    // パフォーマンス基準
    const longAudioResult = results.find((r) => r.duration === 10.0);
    expect(longAudioResult.realtimeTime).toBeLessThan(100); // 10秒を100ms以内
  });

  test('バッチ処理のパフォーマンス測定', async ({ page }) => {
    const results = await page.evaluate(async () => {
      // @ts-ignore
      const { analyzeAll } = window.AudioInspect;

      const duration = 1.0;
      const sampleRate = 48000;
      const signal = window.generateTestSignal(duration, sampleRate);
      const audio = {
        sampleRate,
        channelData: [signal],
        duration,
        numberOfChannels: 1,
        length: signal.length
      };

      // すべての特徴量を一度に計算
      const batchStart = performance.now();
      const batchResult = await analyzeAll(audio, {
        waveform: {
          framesPerSecond: 60,
          channel: 0,
          method: 'rms'
        },
        peaks: {
          count: 100,
          threshold: 0.1,
          channel: 0
        },
        rms: {
          channel: 0,
          asDB: false
        },
        spectrum: {
          fftSize: 2048,
          windowFunction: 'hann',
          channel: 0
        },
        energy: {
          windowSizeMs: 25,
          hopSizeMs: 10,
          channel: 0
        }
      });
      const batchTime = performance.now() - batchStart;

      // 個別に計算した場合の時間を測定
      const individualStart = performance.now();

      // @ts-ignore
      const {
        getRMS,
        getPeakAmplitude,
        getZeroCrossing,
        getSpectrum,
        getSpectralFeatures,
        getEnergy,
        getCrestFactor
      } = window.AudioInspect;

      getRMS(audio, { channel: 0 });
      getPeakAmplitude(audio, { channel: 0 });
      getZeroCrossing(audio, 0);
      await getSpectrum(audio, { fftSize: 2048 });
      await getSpectralFeatures(audio, { fftSize: 2048 });
      getEnergy(audio);
      getCrestFactor(audio);

      const individualTime = performance.now() - individualStart;

      return {
        duration,
        samples: signal.length,
        batchTime,
        individualTime,
        speedup: individualTime / batchTime,
        featuresCalculated: Object.keys(batchResult).length
      };
    });

    console.log('\nバッチ処理パフォーマンス:');
    console.log(`${results.duration}秒 (${results.samples}サンプル):`);
    console.log(`  バッチ処理: ${results.batchTime.toFixed(2)}ms`);
    console.log(`  個別処理: ${results.individualTime.toFixed(2)}ms`);
    console.log(`  高速化率: ${results.speedup.toFixed(2)}x`);
    console.log(`  計算特徴量数: ${results.featuresCalculated}`);

    // バッチ処理がリーズナブルな時間内に完了することを確認
    expect(results.batchTime).toBeLessThan(100); // 100ms以内
    expect(results.featuresCalculated).toBeGreaterThan(5); // 5つ以上の特徴量を計算
  });

  test('メモリ使用量の測定', async ({ page }) => {
    if (!page.context().browser()?.browserType().name().includes('chromium')) {
      test.skip();
      return;
    }

    const memoryUsage = await page.evaluate(async () => {
      // @ts-ignore
      const { stft } = window.AudioInspect;

      // メモリ測定関数
      const getMemoryUsage = () => {
        // @ts-ignore
        if (performance.memory) {
          // @ts-ignore
          return performance.memory.usedJSHeapSize / 1024 / 1024; // MB
        }
        return 0;
      };

      const measurements: any[] = [];

      // 初期メモリ使用量
      const initialMemory = getMemoryUsage();
      measurements.push({ stage: 'initial', memory: initialMemory });

      // 大きな音声データの作成
      const duration = 60; // 60秒
      const sampleRate = 48000;
      const signal = window.generateTestSignal(duration, sampleRate);

      const afterSignalMemory = getMemoryUsage();
      measurements.push({
        stage: 'after_signal_creation',
        memory: afterSignalMemory,
        delta: afterSignalMemory - initialMemory
      });

      // STFT処理
      const stftResult = stft(signal, sampleRate, {
        fftSize: 4096,
        hopSize: 1024
      });

      const afterStftMemory = getMemoryUsage();
      measurements.push({
        stage: 'after_stft',
        memory: afterStftMemory,
        delta: afterStftMemory - afterSignalMemory,
        frameCount: stftResult.frameCount
      });

      // ガベージコレクションを誘発
      // @ts-ignore
      let nullResult = null;
      nullResult = stftResult;
      nullResult = null;
      await new Promise((resolve) => setTimeout(resolve, 100));

      const afterGCMemory = getMemoryUsage();
      measurements.push({
        stage: 'after_gc',
        memory: afterGCMemory,
        recovered: afterStftMemory - afterGCMemory
      });

      return measurements;
    });

    console.log('\nメモリ使用量:');
    memoryUsage.forEach((m) => {
      console.log(`${m.stage}:`);
      console.log(`  使用量: ${m.memory.toFixed(2)}MB`);
      if (m.delta !== undefined) {
        console.log(`  増加量: ${m.delta.toFixed(2)}MB`);
      }
      if (m.recovered !== undefined) {
        console.log(`  回収量: ${m.recovered.toFixed(2)}MB`);
      }
      if (m.frameCount !== undefined) {
        console.log(`  フレーム数: ${m.frameCount}`);
      }
    });

    // メモリ使用量が適切であることを確認
    const stftMemoryDelta = memoryUsage.find((m) => m.stage === 'after_stft')?.delta || 0;
    expect(stftMemoryDelta).toBeLessThan(200); // 200MB以下
  });
});

// ヘルパー関数をグローバルに定義（ブラウザコンテキストで使用）
declare global {
  interface Window {
    generateTestSignal: typeof generateTestSignal;
    AudioInspect: any;
  }
}
