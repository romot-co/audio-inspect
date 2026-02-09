import { describe, expect, it } from 'vitest';
import { RealtimeLUFSExecutor } from '../../src/core/realtime/lufs-executor.js';
import type { AudioData } from '../../src/types.js';

function createSineWave(
  frequency: number,
  durationSec: number,
  sampleRate = 48000,
  amplitude = 0.5
): Float32Array {
  const length = Math.max(1, Math.floor(durationSec * sampleRate));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    output[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return output;
}

function createAudioData(channelData: Float32Array[], sampleRate = 48000): AudioData {
  const firstChannel = channelData[0] ?? new Float32Array(0);
  return {
    sampleRate,
    channelData,
    numberOfChannels: channelData.length,
    length: firstChannel.length,
    duration: firstChannel.length / sampleRate
  };
}

describe('core/realtime/lufs-executor', () => {
  it('does not emit fake loudnessRange/statistics snapshots', () => {
    const executor = new RealtimeLUFSExecutor();
    const audio = createAudioData([createSineWave(1000, 0.2)]);

    const result = executor.process(audio, {
      calculateShortTerm: true,
      calculateLoudnessRange: true
    });

    expect(result.shortTerm).toBeDefined();
    expect(result.shortTerm).toBeTypeOf('number');
    expect(result.loudnessRange).toBeUndefined();
    expect(result.statistics).toBeUndefined();
  });

  it('rejects unsupported bs1770 oversampling factor in realtime true-peak mode', () => {
    const executor = new RealtimeLUFSExecutor();
    const audio = createAudioData([createSineWave(1000, 0.2)]);

    expect(() =>
      executor.process(audio, {
        calculateTruePeak: true,
        truePeakMethod: 'bs1770',
        truePeakOversamplingFactor: 8
      })
    ).toThrow(/truePeakOversamplingFactor=8 is unsupported/);
  });
});
