import { test, expect } from '@playwright/test';

test.describe('Realtime monitor API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/index.html');
  });

  test('monitor() emits frames and supports dynamic feature updates', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const AudioInspect = await import('/dist/index.js');

      const context = new AudioContext();
      await context.resume();

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, context.currentTime);
      gain.gain.setValueAtTime(0.12, context.currentTime);
      oscillator.connect(gain);

      const session = await AudioInspect.monitor({
        context,
        source: gain,
        emit: 'hop',
        features: { rms: true }
      });

      let frameCount = 0;
      let lastRms = 0;

      const offFrame = session.onFrame((frame) => {
        if (typeof frame.results.rms === 'number') {
          frameCount += 1;
          lastRms = frame.results.rms;
        }
      });

      oscillator.start();
      await new Promise((resolve) => setTimeout(resolve, 240));

      await session.setFeature('spectrum', { fftSize: 1024 });
      await new Promise((resolve) => setTimeout(resolve, 240));

      const latest = session.read();
      const spectrum = session.readFeature('spectrum');

      oscillator.stop();
      offFrame();
      await session.close();
      await context.close();

      return {
        frameCount,
        lastRms,
        latestHasRms: typeof latest?.results?.rms === 'number',
        spectrumBins: spectrum?.frequencies?.length ?? 0
      };
    });

    expect(result.frameCount).toBeGreaterThan(0);
    expect(result.lastRms).toBeGreaterThan(0);
    expect(result.latestHasRms).toBe(true);
    expect(result.spectrumBins).toBeGreaterThan(0);
  });
});
