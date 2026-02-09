import { describe, expect, it, vi } from 'vitest';
import { analyze, inspect } from '../../src/core/analyze.js';
import { AudioInspectError, type AudioData } from '../../src/types.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function createAudioData(durationSeconds = 1, sampleRate = 44100): AudioData {
  const length = Math.floor(durationSeconds * sampleRate);
  const channel = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    channel[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
  }
  return {
    sampleRate,
    channelData: [channel],
    numberOfChannels: 1,
    length,
    duration: length / sampleRate
  };
}

function createStereoAudioData(durationSeconds = 1, sampleRate = 44100): AudioData {
  const length = Math.floor(durationSeconds * sampleRate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    left[i] = Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 0.5;
    right[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
  }
  return {
    sampleRate,
    channelData: [left, right],
    numberOfChannels: 2,
    length,
    duration: length / sampleRate
  };
}

const decoder = {
  name: 'test-decoder',
  async decode(): Promise<AudioData> {
    return createAudioData(1, 16000);
  }
};

describe('core/analyze', () => {
  it('analyzes object-style feature selection with typed result map', async () => {
    const audio = createAudioData();
    const result = await analyze(audio, {
      features: {
        rms: { asDB: false },
        peak: true
      }
    });

    expect(typeof result.results.rms).toBe('number');
    expect(typeof result.results.peak).toBe('number');
    expect(result.errors).toEqual({});
    expect(result.meta.channels).toBe(1);
  });

  it('supports array shorthand for default feature options', async () => {
    const audio = createAudioData();
    const result = await analyze(audio, {
      features: ['rms', 'zeroCrossing']
    });

    expect(typeof result.results.rms).toBe('number');
    expect(typeof result.results.zeroCrossing).toBe('number');
  });

  it('supports integrated analysis feature ids via analyze()', async () => {
    const audio = createAudioData(1.2);
    const result = await analyze(audio, {
      features: {
        rmsAnalysis: true,
        peaksAnalysis: { count: 8 },
        waveformAnalysis: { framesPerSecond: 30 }
      }
    });

    expect(result.results.rmsAnalysis?.value).toBeTypeOf('number');
    expect(result.results.peaksAnalysis?.count).toBeGreaterThanOrEqual(0);
    expect(result.results.waveformAnalysis?.frameCount).toBeGreaterThan(0);
  });

  it('supports range analysis and progress callbacks', async () => {
    const audio = createAudioData(2);
    const onProgress = vi.fn();

    const result = await analyze(audio, {
      features: { rms: true, peak: true },
      range: { start: 0.25, end: 1.25 },
      onProgress
    });

    expect(result.meta.range.start).toBe(0.25);
    expect(result.meta.range.end).toBe(1.25);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(result.meta.length).toBeGreaterThan(0);
  });

  it('inspect performs load + analyze in one call', async () => {
    const audio = createAudioData();
    const result = await inspect(audio, {
      features: { rms: true }
    });

    expect(typeof result.results.rms).toBe('number');
    expect(result.meta.loadElapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('supports AbortSignal in analyze (ABORTED)', async () => {
    const audio = createAudioData();
    const controller = new AbortController();
    controller.abort();

    await expect(
      analyze(audio, {
        features: { rms: true },
        signal: controller.signal
      })
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('supports AbortSignal in inspect (ABORTED)', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      inspect(createAudioData(), {
        features: { rms: true },
        signal: controller.signal
      })
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('supports inspect with Blob source (non-AudioLike)', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/wav' });
    const result = await inspect(blob, {
      load: { decoder },
      features: { rms: true }
    });

    expect(typeof result.results.rms).toBe('number');
  });

  it('supports inspect with URL source (non-AudioLike)', async () => {
    const fetchMock = vi.fn(
      async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })
    );
    const result = await inspect(new URL('https://example.com/audio.wav'), {
      load: { decoder, fetch: fetchMock },
      features: { rms: true }
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(typeof result.results.rms).toBe('number');
  });

  it('supports inspect with string file-path source (non-AudioLike)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'audio-inspect-test-'));
    const filePath = join(dir, 'fixture.raw');
    await writeFile(filePath, new Uint8Array([10, 20, 30, 40]));

    try {
      const result = await inspect(filePath, {
        load: { decoder },
        features: { rms: true }
      });
      expect(typeof result.results.rms).toBe('number');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('supports ChannelSelector: mix / all / number[]', async () => {
    const audio = createStereoAudioData();
    const result = await analyze(audio, {
      features: {
        rms: { channel: 'mix' },
        peak: { channel: 'all' },
        zeroCrossing: { channel: [0, 1] }
      }
    });

    expect(typeof result.results.rms).toBe('number');
    expect(typeof result.results.peak).toBe('number');
    expect(typeof result.results.zeroCrossing).toBe('number');
  });

  it('covers advanced features: mfccWithDelta, stereo, timeVaryingStereo', async () => {
    const audio = createStereoAudioData(1.5, 16000);
    const result = await analyze(audio, {
      continueOnError: true,
      features: {
        mfccWithDelta: { numMfccCoeffs: 13, computeDelta: true, computeDeltaDelta: true },
        stereo: true,
        timeVaryingStereo: true
      }
    });

    expect(result.results.mfccWithDelta?.mfcc.length).toBeGreaterThan(0);
    expect(result.results.mfccWithDelta?.delta?.length).toBeGreaterThan(0);
    expect(result.results.stereo?.correlation).toBeTypeOf('number');
    expect(result.results.timeVaryingStereo?.correlation.length).toBeGreaterThan(0);
    expect(result.errors.timeVaryingStereo).toBeUndefined();
  });

  it('returns INSUFFICIENT_DATA for too-short MFCC input when continueOnError=true', async () => {
    const tinyAudio: AudioData = {
      sampleRate: 16000,
      channelData: [new Float32Array([0.1, 0.2])],
      numberOfChannels: 1,
      length: 2,
      duration: 2 / 16000
    };

    const result = await analyze(tinyAudio, {
      continueOnError: true,
      features: { mfcc: true }
    });

    expect(result.errors.mfcc).toBeInstanceOf(AudioInspectError);
    expect(result.errors.mfcc?.code).toBe('INSUFFICIENT_DATA');
  });
});
