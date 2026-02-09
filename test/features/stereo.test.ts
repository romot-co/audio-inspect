import { describe, expect, it } from 'vitest';
import { getStereoAnalysis, getTimeVaryingStereoAnalysis } from '../../src/features/stereo.js';
import type { AudioData } from '../../src/types.js';

function createSineWave(
  frequency: number,
  duration: number,
  sampleRate = 48000,
  amplitude = 1
): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const data = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    data[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }

  return data;
}

function createStereoAudioData(
  left: Float32Array,
  right: Float32Array,
  sampleRate = 48000
): AudioData {
  const length = Math.min(left.length, right.length);
  return {
    sampleRate,
    channelData: [left.subarray(0, length), right.subarray(0, length)],
    duration: length / sampleRate,
    numberOfChannels: 2,
    length
  };
}

describe('getStereoAnalysis', () => {
  it('returns basic stereo metrics', async () => {
    const left = createSineWave(440, 1.0, 48000, 0.8);
    const right = createSineWave(440, 1.0, 48000, 0.4);
    const audio = createStereoAudioData(left, right);

    const result = await getStereoAnalysis(audio);

    expect(result.correlation).toBeGreaterThan(0.8);
    expect(result.width).toBeGreaterThanOrEqual(0);
    expect(result.width).toBeLessThanOrEqual(1);
    expect(result.balance).toBeTypeOf('number');
    expect(result.goniometer?.x.length).toBe(audio.length);
    expect(result.goniometer?.y.length).toBe(audio.length);
  });

  it('calculates MSC coherence and phase correlation when phase analysis is enabled', async () => {
    const left = createSineWave(1000, 1.2, 48000, 0.7);
    const right = left.slice();
    const audio = createStereoAudioData(left, right);

    const result = await getStereoAnalysis(audio, {
      calculatePhase: true,
      frameSize: 4096
    });

    expect(result.coherence).toBeDefined();
    expect(result.phaseCorrelation).toBeDefined();
    expect(result.phaseDifference).toBeDefined();
    if (result.coherence) {
      const avgCoherence =
        result.coherence.reduce((sum, value) => sum + value, 0) / result.coherence.length;
      expect(avgCoherence).toBeGreaterThan(0.8);
    }
    expect(result.phaseCorrelation ?? 0).toBeGreaterThan(0.8);
  });

  it('detects inverse phase correlation for anti-phase stereo', async () => {
    const left = createSineWave(300, 1.0, 48000, 0.8);
    const right = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      right[i] = -(left[i] ?? 0);
    }
    const audio = createStereoAudioData(left, right);

    const result = await getStereoAnalysis(audio, {
      calculatePhase: true,
      frameSize: 4096
    });

    expect(result.phaseCorrelation ?? 0).toBeLessThan(-0.8);
  });
});

describe('getTimeVaryingStereoAnalysis', () => {
  it('returns time-varying stereo metrics instead of unsupported error', async () => {
    const left = createSineWave(220, 1.5, 48000, 0.8);
    const right = createSineWave(440, 1.5, 48000, 0.6);
    const audio = createStereoAudioData(left, right);

    const result = await getTimeVaryingStereoAnalysis(audio, {
      windowSize: 2048,
      hopSize: 1024
    });

    expect(result.times.length).toBeGreaterThan(0);
    expect(result.correlation.length).toBe(result.times.length);
    expect(result.width.length).toBe(result.times.length);
    expect(result.balance.length).toBe(result.times.length);
  });
});
