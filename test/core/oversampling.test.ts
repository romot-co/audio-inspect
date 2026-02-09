import { describe, expect, it } from 'vitest';
import { getInterSamplePeak, getTruePeak } from '../../src/core/dsp/oversampling.js';

function createSineWave(
  frequency: number,
  durationSec: number,
  sampleRate = 48000,
  amplitude = 1,
  phaseRad = 0
): Float32Array {
  const length = Math.max(1, Math.floor(durationSec * sampleRate));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    output[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate + phaseRad);
  }
  return output;
}

function samplePeak(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]!));
  }
  return peak;
}

describe('core/dsp/oversampling', () => {
  it('returns 0 for empty input', () => {
    const empty = new Float32Array(0);
    expect(getInterSamplePeak(empty)).toBe(0);
    expect(getTruePeak(empty)).toBe(0);
  });

  it('supports legacy interpolation-based inter-sample peak', () => {
    const signal = createSineWave(15000, 0.5, 48000, 0.95, 0.37);
    const peak = getInterSamplePeak(signal, { factor: 8, interpolation: 'sinc' });

    expect(peak).toBeGreaterThan(0);
    expect(Number.isFinite(peak)).toBe(true);
  });

  it('supports BS.1770 true-peak estimation (2x/4x)', () => {
    const signal = createSineWave(15000, 0.5, 48000, 0.95, 0.37);
    const discretePeak = samplePeak(signal);
    const truePeak2x = getTruePeak(signal, { factor: 2 });
    const truePeak4x = getTruePeak(signal, { factor: 4 });

    expect(truePeak2x).toBeGreaterThanOrEqual(discretePeak);
    expect(truePeak4x).toBeGreaterThanOrEqual(discretePeak);
  });

  it('rejects unsupported factors for BS.1770 mode', () => {
    const signal = createSineWave(1000, 0.1);
    expect(() => getTruePeak(signal, { factor: 4 })).not.toThrow();
    expect(() => getTruePeak(signal, { factor: 8 as 2 | 4 })).toThrow();
  });
});
