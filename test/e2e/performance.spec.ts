import { test, expect } from '@playwright/test';

test.describe('Offline API smoke/perf', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/index.html');
  });

  test('load + analyze + inspect should work with new API contracts', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const AudioInspect = await import('/dist/index.js');

      const sampleRate = 48_000;
      const durationSec = 1;
      const length = sampleRate * durationSec;

      const left = new Float32Array(length);
      const right = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        left[i] = Math.sin(2 * Math.PI * 440 * t) * 0.2;
        right[i] = Math.sin(2 * Math.PI * 660 * t) * 0.2;
      }

      const stereo = {
        sampleRate,
        channelData: [left, right],
        numberOfChannels: 2,
        length,
        duration: durationSec
      };

      const loadedMono = await AudioInspect.load(stereo, { channels: 'mono', normalize: true });

      const analyzed = await AudioInspect.analyze(loadedMono, {
        features: ['rms', 'peak'] as const,
        range: { start: 0, end: 0.5 }
      });

      const inspected = await AudioInspect.inspect(loadedMono, {
        features: { spectrum: { fftSize: 1024 } }
      });

      return {
        monoChannels: loadedMono.numberOfChannels,
        rms: analyzed.results.rms,
        peak: analyzed.results.peak,
        analyzedDuration: analyzed.meta.duration,
        spectrumBins: inspected.results.spectrum?.frequencies?.length ?? 0,
        loadElapsedMs: inspected.meta.loadElapsedMs
      };
    });

    expect(result.monoChannels).toBe(1);
    expect(typeof result.rms).toBe('number');
    expect(typeof result.peak).toBe('number');
    expect(result.analyzedDuration).toBeGreaterThan(0.49);
    expect(result.analyzedDuration).toBeLessThanOrEqual(0.5);
    expect(result.spectrumBins).toBeGreaterThan(0);
    expect(result.loadElapsedMs).toBeGreaterThanOrEqual(0);
  });
});
