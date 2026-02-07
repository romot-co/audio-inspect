import { describe, expect, it } from 'vitest';
import { analyze } from '../src/index.js';
import type { AudioData } from '../src/types.js';

function createAudio(durationSeconds = 2, sampleRate = 44100): AudioData {
  const length = Math.floor(durationSeconds * sampleRate);
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    mono[i] =
      0.5 * Math.sin((2 * Math.PI * 220 * i) / sampleRate) +
      0.2 * Math.sin((2 * Math.PI * 880 * i) / sampleRate);
  }
  return {
    sampleRate,
    channelData: [mono],
    numberOfChannels: 1,
    length,
    duration: durationSeconds
  };
}

describe('basic performance sanity', () => {
  it('analyzes common feature set within reasonable time', async () => {
    const audio = createAudio();
    const startedAt = performance.now();

    const result = await analyze(audio, {
      features: {
        rms: true,
        peak: true,
        zeroCrossing: true,
        spectrum: { fftSize: 1024 }
      }
    });

    const elapsed = performance.now() - startedAt;

    expect(typeof result.results.rms).toBe('number');
    expect(typeof result.results.peak).toBe('number');
    expect(typeof result.results.zeroCrossing).toBe('number');
    expect(result.results.spectrum?.frequencies.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(3000);
  });
});
