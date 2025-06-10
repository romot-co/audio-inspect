import {
  AudioData,
  BatchAnalysisOptions,
  BatchAnalysisResult,
  WaveformAnalysisResult,
  PeaksAnalysisResult,
  RMSAnalysisResult
} from '../types.js';
import { getWaveformAnalysis, getPeaksAnalysis, getRMSAnalysis } from '../features/time.js';
import { getFFT, type FFTOptions, type FFTAnalysisResult } from '../features/frequency.js';
import { getEnergy, type EnergyResult } from '../features/energy.js';
import { getPerformanceNow } from './utils.js';

/**
 * バッチ解析タスクの型定義
 */
interface AnalysisTask {
  name: keyof BatchAnalysisResult;
  weight: number;
  execute: () => Promise<unknown> | unknown;
}

/**
 * バッチ解析：複数の機能を一度に実行
 */
export async function analyzeAll(
  audio: AudioData,
  options: BatchAnalysisOptions
): Promise<BatchAnalysisResult> {
  const startTime = getPerformanceNow();
  const result: BatchAnalysisResult = {
    processingTime: 0
  };

  const tasks: AnalysisTask[] = [];

  // タスクを準備
  if (options.waveform !== undefined) {
    tasks.push({
      name: 'waveform',
      weight: 0.15,
      execute: () =>
        getWaveformAnalysis(audio, {
          ...options.waveform,
          onProgress: (percent, msg) => options.onProgress?.(percent * 0.15, `Waveform: ${msg}`)
        })
    });
  }

  if (options.peaks !== undefined) {
    tasks.push({
      name: 'peaks',
      weight: 0.2,
      execute: () =>
        getPeaksAnalysis(audio, {
          ...options.peaks,
          onProgress: (percent, msg) => options.onProgress?.(percent * 0.2, `Peaks: ${msg}`)
        })
    });
  }

  if (options.rms !== undefined) {
    tasks.push({
      name: 'rms',
      weight: 0.1,
      execute: () =>
        getRMSAnalysis(audio, {
          ...options.rms,
          onProgress: (percent, msg) => options.onProgress?.(percent * 0.1, `RMS: ${msg}`)
        })
    });
  }

  if (options.spectrum !== undefined) {
    tasks.push({
      name: 'spectrum',
      weight: 0.35,
      execute: async () => {
        const fftOptions: FFTOptions = {};
        if (options.spectrum?.fftSize !== undefined) {
          fftOptions.fftSize = options.spectrum.fftSize;
        }
        if (options.spectrum?.channel !== undefined) {
          fftOptions.channel = options.spectrum.channel;
        }
        if (options.spectrum?.windowFunction !== undefined) {
          fftOptions.windowFunction =
            options.spectrum.windowFunction === 'rectangular'
              ? 'none'
              : options.spectrum.windowFunction;
        }
        // FFTAnalysisResultをSpectrumAnalysisResultに変換
        const fftResult: FFTAnalysisResult = await getFFT(audio, fftOptions);
        return {
          frequencies: fftResult.frequencies,
          magnitudes: fftResult.magnitude,
          phases: fftResult.phase,
          fftSize: fftResult.fftSize,
          windowFunction: fftResult.windowFunction,
          sampleRate: audio.sampleRate,
          duration: audio.duration
        };
      }
    });
  }

  if (options.energy !== undefined) {
    tasks.push({
      name: 'energy',
      weight: 0.2,
      execute: () => {
        // EnergyResultをEnergyAnalysisResultに変換
        const energyResult: EnergyResult = getEnergy(audio, {
          ...options.energy
        });
        return {
          energies: energyResult.energies,
          times: energyResult.times,
          totalEnergy: energyResult.totalEnergy,
          meanEnergy: energyResult.statistics.mean,
          maxEnergy: energyResult.statistics.max,
          minEnergy: energyResult.statistics.min,
          sampleRate: audio.sampleRate,
          duration: audio.duration
        };
      }
    });
  }

  // 重みを正規化
  const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0);
  if (totalWeight > 0) {
    tasks.forEach((task) => (task.weight /= totalWeight));
  }

  // 並列実行
  let completedWeight = 0;
  await Promise.all(
    tasks.map(async (task) => {
      try {
        const taskResult = await task.execute();

        // 型安全な結果の代入
        switch (task.name) {
          case 'waveform':
            if (taskResult) {
              result.waveform = taskResult as WaveformAnalysisResult;
            }
            break;
          case 'peaks':
            if (taskResult) {
              result.peaks = taskResult as PeaksAnalysisResult;
            }
            break;
          case 'rms':
            if (taskResult) {
              result.rms = taskResult as RMSAnalysisResult;
            }
            break;
          case 'spectrum':
            if (taskResult) {
              result.spectrum = taskResult as import('../types.js').SpectrumAnalysisResult;
            }
            break;
          case 'energy':
            if (taskResult) {
              result.energy = taskResult as import('../types.js').EnergyAnalysisResult;
            }
            break;
        }

        completedWeight += task.weight;
        options.onProgress?.(Math.round(completedWeight * 100), task.name);
      } catch (error) {
        console.warn(`Task ${task.name} failed:`, error);
        // 一つのタスクが失敗しても他のタスクは続行
      }
    })
  );

  result.processingTime = getPerformanceNow() - startTime;
  return result;
}
