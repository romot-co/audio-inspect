import { describe, expect, it } from 'vitest';
import { fillWindowedFrameInto, getWindow } from '../../src/core/dsp/window.js';

describe('core/dsp/window', () => {
  it('generates windows with expected length and endpoints', () => {
    const hann = getWindow(8, 'hann');
    const hamming = getWindow(8, 'hamming');
    const blackman = getWindow(8, 'blackman');

    expect(hann.length).toBe(8);
    expect(hann[0]).toBeCloseTo(0, 6);
    expect(hann[7]).toBeCloseTo(0, 6);

    expect(hamming.length).toBe(8);
    expect(hamming[0]).toBeCloseTo(0.08, 2);
    expect(hamming[7]).toBeCloseTo(0.08, 2);

    expect(blackman.length).toBe(8);
    expect(blackman[0]).toBeCloseTo(0, 5);
    expect(blackman[7]).toBeCloseTo(0, 5);
  });

  it('applies frame-length window when frameSize < fftSize', () => {
    const src = new Float32Array([1, 1, 1, 1, 1, 1, 1, 1]);
    const dst = new Float32Array(8);
    const frameLength = 4;
    const expectedWindow = getWindow(frameLength, 'hann');

    fillWindowedFrameInto({
      src,
      srcStart: 0,
      frameLength,
      dst,
      windowType: 'hann'
    });

    for (let i = 0; i < frameLength; i++) {
      expect(dst[i]).toBeCloseTo(expectedWindow[i]!, 6);
    }
    for (let i = frameLength; i < dst.length; i++) {
      expect(dst[i]).toBe(0);
    }
  });
});
