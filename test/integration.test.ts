import { describe, expect, it } from 'vitest';
import { analyze, inspect, load, FEATURES } from '../src/index.js';
import type { AudioData } from '../src/types.js';

function createStereoAudio(durationSeconds = 1, sampleRate = 48000): AudioData {
  const length = Math.floor(durationSeconds * sampleRate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    left[i] = Math.sin(2 * Math.PI * 220 * t) * 0.4;
    right[i] = Math.sin(2 * Math.PI * 440 * t) * 0.4;
  }
  return {
    sampleRate,
    channelData: [left, right],
    numberOfChannels: 2,
    length,
    duration: length / sampleRate
  };
}

describe('public API integration', () => {
  it('exports builtin feature list', () => {
    expect(FEATURES.length).toBeGreaterThan(0);
    expect(FEATURES).toContain('rms');
    expect(FEATURES).toContain('spectrum');
  });

  it('load accepts AudioData and applies transforms', async () => {
    const source = createStereoAudio();
    const loaded = await load(source, { channels: 'mono', normalize: true, sampleRate: 44100 });

    expect(loaded.sampleRate).toBe(44100);
    expect(loaded.numberOfChannels).toBe(1);
    expect(loaded.length).toBeGreaterThan(0);
  });

  it('analyze computes multi-feature results in one pass request', async () => {
    const audio = createStereoAudio();
    const result = await analyze(audio, {
      features: {
        rms: { asDB: true },
        peak: true,
        spectrum: { fftSize: 1024 }
      }
    });

    expect(typeof result.results.rms).toBe('number');
    expect(typeof result.results.peak).toBe('number');
    expect(result.results.spectrum?.frequencies.length).toBeGreaterThan(0);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('inspect works as one-shot API', async () => {
    const audio = createStereoAudio();
    const result = await inspect(audio, {
      features: ['rms', 'zeroCrossing']
    });

    expect(typeof result.results.rms).toBe('number');
    expect(typeof result.results.zeroCrossing).toBe('number');
    expect(result.meta.loadElapsedMs).toBeGreaterThanOrEqual(0);
  });
});
