import { describe, it, expect, vi } from 'vitest';
import { load } from '../../src/core/load.js';
import { AudioInspectError, type AudioData } from '../../src/types.js';

function createTestAudioData(data: Float32Array, sampleRate = 44100): AudioData {
  return {
    sampleRate,
    channelData: [data],
    duration: data.length / sampleRate,
    numberOfChannels: 1,
    length: data.length
  };
}

function createSineWave(
  frequency: number,
  duration: number,
  sampleRate = 44100,
  amplitude = 1
): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const data = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    data[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
  }

  return data;
}

function calculateToneMagnitude(
  samples: Float32Array,
  sampleRate: number,
  frequency: number
): number {
  let real = 0;
  let imag = 0;
  const angularStep = (2 * Math.PI * frequency) / sampleRate;
  for (let i = 0; i < samples.length; i++) {
    const phase = angularStep * i;
    const sample = samples[i] ?? 0;
    real += sample * Math.cos(phase);
    imag -= sample * Math.sin(phase);
  }
  return (2 / Math.max(1, samples.length)) * Math.hypot(real, imag);
}

describe('load', () => {
  describe('basic functionality', () => {
    it('should load existing AudioData without modification', async () => {
      const originalSignal = createSineWave(440, 1.0, 44100, 0.5);
      const originalAudio = createTestAudioData(originalSignal);

      const result = await load(originalAudio);

      expect(result.sampleRate).toBe(44100);
      expect(result.numberOfChannels).toBe(1);
      expect(result.length).toBe(originalAudio.length);
      expect(result.duration).toBeCloseTo(1.0, 2);
    });

    it('should handle mono conversion', async () => {
      const channel0 = createSineWave(440, 1.0, 44100, 0.5);
      const channel1 = createSineWave(880, 1.0, 44100, 0.3);

      const stereoAudio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: 1.0,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result = await load(stereoAudio, { channels: 'mono' });

      expect(result.numberOfChannels).toBe(1);
      expect(result.channelData.length).toBe(1);
      expect(result.length).toBe(stereoAudio.length);
    });

    it('should handle normalization', async () => {
      const signal = createSineWave(440, 1.0, 44100, 0.3);
      const audio = createTestAudioData(signal);

      const result = await load(audio, { normalize: true });

      let maxAmplitude = 0;
      const channelData = result.channelData[0];
      if (channelData) {
        for (const sample of channelData) {
          maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
        }
      }
      expect(maxAmplitude).toBeCloseTo(1.0, 2);
    });
  });

  describe('sample rate conversion', () => {
    const isOfflineAudioContextAvailable = (): boolean => {
      return typeof OfflineAudioContext !== 'undefined';
    };

    it('should resample from 44.1kHz to 48kHz', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContext is unavailable in this environment, skipping this test');
        return;
      }

      const originalSignal = createSineWave(1000, 1.0, 44100, 0.5);
      const originalAudio = createTestAudioData(originalSignal, 44100);

      const result = await load(originalAudio, { sampleRate: 48000 });

      expect(result.sampleRate).toBe(48000);
      expect(result.numberOfChannels).toBe(1);

      expect(result.length).toBeCloseTo((originalAudio.length * 48000) / 44100, 100);
      expect(result.duration).toBeCloseTo(1.0, 2);
    });

    it('should resample from 48kHz to 44.1kHz', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContext is unavailable in this environment, skipping this test');
        return;
      }

      const originalSignal = createSineWave(440, 2.0, 48000, 0.7);
      const originalAudio = createTestAudioData(originalSignal, 48000);

      const result = await load(originalAudio, { sampleRate: 44100 });

      expect(result.sampleRate).toBe(44100);
      expect(result.length).toBeCloseTo((originalAudio.length * 44100) / 48000, 100);
      expect(result.duration).toBeCloseTo(2.0, 2);
    });

    it('should handle downsampling to lower rates', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContext is unavailable in this environment, skipping this test');
        return;
      }

      const originalSignal = createSineWave(400, 0.5, 44100, 0.8);
      const originalAudio = createTestAudioData(originalSignal, 44100);

      const result = await load(originalAudio, { sampleRate: 22050 });

      expect(result.sampleRate).toBe(22050);
      expect(result.length).toBeCloseTo(originalAudio.length / 2, 100);
      expect(result.duration).toBeCloseTo(0.5, 2);
    });

    it('should handle upsampling to higher rates', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContext is unavailable in this environment, skipping this test');
        return;
      }

      const originalSignal = createSineWave(200, 1.5, 22050, 0.6);
      const originalAudio = createTestAudioData(originalSignal, 22050);

      const result = await load(originalAudio, { sampleRate: 44100 });

      expect(result.sampleRate).toBe(44100);
      expect(result.length).toBeCloseTo(originalAudio.length * 2, 100);
      expect(result.duration).toBeCloseTo(1.5, 2);
    });

    it('should resample stereo audio correctly', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContext is unavailable in this environment, skipping this test');
        return;
      }

      const channel0 = createSineWave(440, 1.0, 44100, 0.5);
      const channel1 = createSineWave(880, 1.0, 44100, 0.3);

      const stereoAudio: AudioData = {
        sampleRate: 44100,
        channelData: [channel0, channel1],
        duration: 1.0,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result = await load(stereoAudio, { sampleRate: 48000 });

      expect(result.sampleRate).toBe(48000);
      expect(result.numberOfChannels).toBe(2);
      expect(result.channelData.length).toBe(2);
      expect(result.length).toBeCloseTo((stereoAudio.length * 48000) / 44100, 100);
    });

    it('should combine resampling with other options', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContext is unavailable in this environment, skipping this test');
        return;
      }

      const channel0 = createSineWave(440, 2.0, 48000, 0.4);
      const channel1 = createSineWave(880, 2.0, 48000, 0.6);

      const stereoAudio: AudioData = {
        sampleRate: 48000,
        channelData: [channel0, channel1],
        duration: 2.0,
        numberOfChannels: 2,
        length: channel0.length
      };

      const result = await load(stereoAudio, {
        sampleRate: 44100,
        channels: 'mono',
        normalize: true
      });

      expect(result.sampleRate).toBe(44100);
      expect(result.numberOfChannels).toBe(1);
      expect(result.length).toBeCloseTo((stereoAudio.length * 44100) / 48000, 100);

      let maxAmplitude = 0;
      const channelData = result.channelData[0];
      if (channelData) {
        for (const sample of channelData) {
          maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
        }
      }
      expect(maxAmplitude).toBeCloseTo(1.0, 1);
    });

    it('should preserve audio quality during resampling', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContext is unavailable in this environment, skipping this test');
        return;
      }

      const originalSignal = createSineWave(220, 1.0, 44100, 1.0);
      const originalAudio = createTestAudioData(originalSignal, 44100);

      const result = await load(originalAudio, { sampleRate: 48000 });

      const channelData = result.channelData[0];
      expect(channelData).toBeDefined();
      if (channelData) {
        expect(channelData.length).toBeGreaterThan(0);

        let maxAmplitude = 0;
        for (const sample of channelData) {
          maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
        }
        expect(maxAmplitude).toBeGreaterThan(0.5);
        expect(maxAmplitude).toBeLessThan(1.5);
      }
    });

    it('should reduce aliasing in high-quality downsampling compared with fast mode', async () => {
      if (!isOfflineAudioContextAvailable()) {
        console.log('OfflineAudioContext is unavailable in this environment, skipping this test');
        return;
      }

      const sourceSampleRate = 48000;
      const targetSampleRate = 16000;
      const sourceToneHz = 10000; // Above target Nyquist (8kHz), aliases to 6kHz.
      const originalSignal = createSineWave(sourceToneHz, 1.0, sourceSampleRate, 0.8);
      const originalAudio = createTestAudioData(originalSignal, sourceSampleRate);

      const highQuality = await load(originalAudio, {
        sampleRate: targetSampleRate,
        resampleQuality: 'high'
      });
      const fastQuality = await load(originalAudio, {
        sampleRate: targetSampleRate,
        resampleQuality: 'fast'
      });

      const aliasFrequency = Math.abs(
        sourceToneHz - targetSampleRate * Math.round(sourceToneHz / targetSampleRate)
      );
      const highMagnitude = calculateToneMagnitude(
        highQuality.channelData[0] ?? new Float32Array(0),
        targetSampleRate,
        aliasFrequency
      );
      const fastMagnitude = calculateToneMagnitude(
        fastQuality.channelData[0] ?? new Float32Array(0),
        targetSampleRate,
        aliasFrequency
      );

      expect(highMagnitude).toBeLessThan(fastMagnitude);
    });

    it('should not modify audio when target sample rate matches original', async () => {
      const originalSignal = createSineWave(1000, 1.0, 44100, 0.5);
      const originalAudio = createTestAudioData(originalSignal, 44100);

      const result = await load(originalAudio, { sampleRate: 44100 });

      expect(result.sampleRate).toBe(44100);
      expect(result.length).toBe(originalAudio.length);
      const resultChannel = result.channelData[0];
      const originalChannel = originalAudio.channelData[0];
      if (resultChannel && originalChannel) {
        expect(resultChannel).toEqual(originalChannel);
      }
    });

    it('should resample in fast mode without relying on OfflineAudioContext', async () => {
      const originalSignal = createSineWave(1000, 1.0, 44100, 0.5);
      const originalAudio = createTestAudioData(originalSignal, 44100);

      const result = await load(originalAudio, {
        sampleRate: 48000,
        resampleQuality: 'fast'
      });
      expect(result.sampleRate).toBe(48000);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use injected resampler backend in high-quality mode', async () => {
      const originalSignal = createSineWave(1000, 1.0, 44100, 0.5);
      const originalAudio = createTestAudioData(originalSignal, 44100);
      const resampler = vi.fn(async (audio: AudioData, sampleRate: number): Promise<AudioData> => {
        const newLength = Math.max(1, Math.round((audio.length * sampleRate) / audio.sampleRate));
        const channelData = audio.channelData.map((channel) => {
          const out = new Float32Array(newLength);
          for (let i = 0; i < newLength; i++) {
            const sourceIndex = Math.min(
              channel.length - 1,
              Math.floor((i * audio.sampleRate) / sampleRate)
            );
            out[i] = channel[sourceIndex] ?? 0;
          }
          return out;
        });
        return {
          sampleRate,
          numberOfChannels: audio.numberOfChannels,
          channelData,
          length: newLength,
          duration: newLength / sampleRate
        };
      });

      const result = await load(originalAudio, {
        sampleRate: 48000,
        resampleQuality: 'high',
        resampler
      });

      expect(resampler).toHaveBeenCalledTimes(1);
      expect(result.sampleRate).toBe(48000);
    });

    it('should throw when high-quality resampling backend is unavailable', async () => {
      const isNodeRuntime = typeof process !== 'undefined' && !!process.versions?.node;
      if (!isNodeRuntime) {
        return;
      }

      const originalSignal = createSineWave(1000, 1.0, 44100, 0.5);
      const originalAudio = createTestAudioData(originalSignal, 44100);

      await expect(load(originalAudio, { sampleRate: 48000 })).rejects.toMatchObject({
        code: 'PROCESSING_ERROR'
      });
    });
  });

  describe('error handling', () => {
    it('should handle empty audio data', async () => {
      const emptyAudio = createTestAudioData(new Float32Array(0));

      const result = await load(emptyAudio);

      expect(result.length).toBe(0);
      expect(result.sampleRate).toBe(44100);
    });

    it('should preserve channel structure for empty channels', async () => {
      const emptyChannel = new Float32Array(0);
      const emptyAudio: AudioData = {
        sampleRate: 44100,
        channelData: [emptyChannel],
        duration: 0,
        numberOfChannels: 1,
        length: 0
      };

      const result = await load(emptyAudio, {
        normalize: true
      });

      expect(result.numberOfChannels).toBe(1);
      expect(result.channelData.length).toBe(1);
      expect(result.length).toBe(0);
    });

    it('should throw ABORTED when signal is pre-aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        load(createTestAudioData(createSineWave(440, 0.2)), { signal: controller.signal })
      ).rejects.toMatchObject({ code: 'ABORTED' });
    });

    it('should throw DECODE_BACKEND_MISSING when decoder is required in Node runtime', async () => {
      await expect(load(new Uint8Array([1, 2, 3, 4]).buffer)).rejects.toMatchObject({
        code: 'DECODE_BACKEND_MISSING'
      });
    });

    it('should propagate MEMORY_ERROR from decoder backend', async () => {
      const decoder = {
        name: 'memory-failing-decoder',
        async decode() {
          throw new AudioInspectError('MEMORY_ERROR', 'Out of memory while decoding');
        }
      };

      await expect(load(new Uint8Array([1, 2, 3, 4]).buffer, { decoder })).rejects.toMatchObject({
        code: 'MEMORY_ERROR'
      });
    });

    it('passes AbortSignal to fetch implementation', async () => {
      const signalController = new AbortController();
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.signal).toBe(signalController.signal);
        return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
      });

      const decoder = {
        name: 'pass-through-decoder',
        async decode() {
          return createTestAudioData(createSineWave(440, 0.05));
        }
      };

      const result = await load(new URL('https://example.com/audio.wav'), {
        signal: signalController.signal,
        fetch: fetchMock,
        decoder
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.length).toBeGreaterThan(0);
    });

    it('treats string inputs as file paths in Node runtime', async () => {
      const fetchMock = vi.fn(
        async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })
      );

      await expect(
        load('https://example.com/audio.wav', {
          fetch: fetchMock
        })
      ).rejects.toBeInstanceOf(AudioInspectError);

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
