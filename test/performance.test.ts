import { describe, expect, it } from 'vitest';
import { analyze } from '../src/index.js';
import type { AudioData } from '../src/types.js';
import type { FeatureInput } from '../src/core/feature-registry.js';

const WARMUP_RUNS = 1;
const SAMPLE_RUNS = 5;

function createAudio(durationSeconds = 2, sampleRate = 44100): AudioData {
  const length = Math.floor(durationSeconds * sampleRate);
  const mono = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const sweep = Math.sin(2 * Math.PI * (220 + 440 * t) * t) * 0.12;
    mono[i] =
      0.42 * Math.sin((2 * Math.PI * 220 * i) / sampleRate) +
      0.28 * Math.sin((2 * Math.PI * 880 * i) / sampleRate) +
      sweep;
  }

  return {
    sampleRate,
    channelData: [mono],
    numberOfChannels: 1,
    length,
    duration: durationSeconds
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return 0;
  }

  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return sorted[middle]!;
}

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return 0;
  }
  const clamped = Math.min(Math.max(p, 0), 1);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * clamped) - 1);
  return sorted[index]!;
}

async function measureAnalyzeRuns(
  audio: AudioData,
  features: FeatureInput,
  warmups = WARMUP_RUNS,
  runs = SAMPLE_RUNS
): Promise<{
  samplesMs: number[];
  medianMs: number;
  p95Ms: number;
  maxMs: number;
}> {
  for (let i = 0; i < warmups; i++) {
    await analyze(audio, { features });
  }

  const samplesMs: number[] = [];
  for (let i = 0; i < runs; i++) {
    const startedAt = performance.now();
    await analyze(audio, { features });
    samplesMs.push(performance.now() - startedAt);
  }

  return {
    samplesMs,
    medianMs: median(samplesMs),
    p95Ms: percentile(samplesMs, 0.95),
    maxMs: Math.max(...samplesMs)
  };
}

describe('performance regression guards', () => {
  it('keeps lite/standard/heavy workloads under loose guardrails', async () => {
    const audio = createAudio(2, 44100);

    const cases: ReadonlyArray<{
      name: string;
      features: FeatureInput;
      medianBudgetMs: number;
    }> = [
      {
        name: 'lite',
        features: { rms: true, peak: true, zeroCrossing: true },
        medianBudgetMs: 1200
      },
      {
        name: 'standard',
        features: {
          rms: true,
          peak: true,
          zeroCrossing: true,
          spectrum: { fftSize: 1024 }
        },
        medianBudgetMs: 2500
      },
      {
        name: 'heavy',
        features: {
          rms: true,
          spectrogram: { fftSize: 1024, frameSize: 1024, hopSize: 512, maxFrames: 48 }
        },
        medianBudgetMs: 4500
      }
    ];

    for (const perfCase of cases) {
      const metrics = await measureAnalyzeRuns(audio, perfCase.features);
      expect(metrics.medianMs, `${perfCase.name} median`).toBeLessThan(perfCase.medianBudgetMs);
      expect(metrics.maxMs, `${perfCase.name} max`).toBeLessThan(perfCase.medianBudgetMs * 3);
    }
  });

  it('scales near-linearly with longer input for standard workload', async () => {
    const shortAudio = createAudio(1, 44100);
    const longAudio = createAudio(4, 44100);
    const features: FeatureInput = {
      rms: true,
      peak: true,
      zeroCrossing: true,
      spectrum: { fftSize: 2048 }
    };

    const shortMetrics = await measureAnalyzeRuns(shortAudio, features, 1, 4);
    const longMetrics = await measureAnalyzeRuns(longAudio, features, 1, 4);

    const ratio = longMetrics.medianMs / Math.max(shortMetrics.medianMs, 1);

    expect(ratio).toBeLessThan(8);
    expect(longMetrics.medianMs).toBeLessThan(5000);
  });

  it('stays stable across repeated standard runs', async () => {
    const audio = createAudio(2, 44100);
    const features: FeatureInput = {
      rms: true,
      peak: true,
      zeroCrossing: true,
      spectrum: { fftSize: 1024 }
    };

    const metrics = await measureAnalyzeRuns(audio, features, 2, 12);

    expect(metrics.p95Ms).toBeLessThan(4000);
    expect(metrics.maxMs).toBeLessThan(Math.max(metrics.medianMs * 6, 5000));
  });
});
