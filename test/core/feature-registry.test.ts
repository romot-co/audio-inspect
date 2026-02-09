import { describe, expect, it } from 'vitest';
import {
  executeFeature,
  FEATURES,
  getActiveFeatureEntries
} from '../../src/core/feature-registry.js';
import { RealtimeLUFSExecutor } from '../../src/core/realtime/lufs-executor.js';
import type { AudioData } from '../../src/types.js';

function createAudioData(durationSeconds = 0.5, sampleRate = 48000): AudioData {
  const length = Math.floor(durationSeconds * sampleRate);
  const channel = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    channel[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.4;
  }
  return {
    sampleRate,
    channelData: [channel],
    numberOfChannels: 1,
    length,
    duration: length / sampleRate
  };
}

describe('core/feature-registry', () => {
  it('includes integrated analysis feature ids in FEATURES', () => {
    expect(FEATURES).toContain('rmsAnalysis');
    expect(FEATURES).toContain('peaksAnalysis');
    expect(FEATURES).toContain('waveformAnalysis');
  });

  it('executes waveformAnalysis via registry', async () => {
    const audio = createAudioData(1);
    const result = await executeFeature('waveformAnalysis', audio, {
      framesPerSecond: 20
    });

    expect(result.frameCount).toBeGreaterThan(0);
    expect(result.amplitudes.length).toBe(result.frameCount);
  });

  it('maintains LUFS state across frames when realtime runtime is injected', async () => {
    const frame = createAudioData(1024 / 48000, 48000);
    const realtimeRuntime = { realtimeLUFS: new RealtimeLUFSExecutor() };

    let accumulated;
    for (let i = 0; i < 80; i++) {
      accumulated = await executeFeature(
        'lufs',
        frame,
        {
          calculateMomentary: true,
          calculateShortTerm: true
        },
        realtimeRuntime
      );
    }

    const stateless = await executeFeature('lufs', frame, {
      calculateMomentary: true,
      calculateShortTerm: true
    });

    expect(accumulated?.integrated).toBeGreaterThan(-Infinity);
    expect(stateless.integrated).toBe(-Infinity);
    realtimeRuntime.realtimeLUFS.dispose();
  });

  it('ignores null/false entries when collecting active features', () => {
    const active = getActiveFeatureEntries({
      rms: true,
      peak: false as unknown as true,
      zeroCrossing: null as unknown as true
    });

    expect(active).toHaveLength(1);
    expect(active[0]?.[0]).toBe('rms');
  });
});
