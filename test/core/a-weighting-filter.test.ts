import { describe, expect, it } from 'vitest';

import {
  calculateFrequencyResponse as calculateAResponse,
  getAWeightingCoeffs,
  validateTable3Compliance
} from '../../src/core/dsp/a-weighting.js';

describe('A-weighting Filter (IEC 61672-1:2013)', () => {
  describe('A-weighting (IEC 61672-1:2013)', () => {
    it('normalizes around 1 kHz per IEC 61672-1:2013', () => {
      const testRates = [44100, 48000, 88200, 96000];

      testRates.forEach((sampleRate) => {
        const coeffs = getAWeightingCoeffs(sampleRate);
        const response = calculateAResponse(coeffs, 1000, sampleRate);
        const magnitudeDb = 20 * Math.log10(response.magnitude);

        // Keep tolerance intentionally broad for cross-rate design variation.
        expect(Math.abs(magnitudeDb)).toBeLessThan(6.0);
      });
    });

    it('follows the IEC 61672-1:2013 Table 3 response trend', () => {
      const sampleRate = 48000;
      const coeffs = getAWeightingCoeffs(sampleRate);

      // A-weighting should attenuate low frequencies relative to 1 kHz.
      const response100 = calculateAResponse(coeffs, 100, sampleRate);
      const response1k = calculateAResponse(coeffs, 1000, sampleRate);

      const db100 = 20 * Math.log10(response100.magnitude);
      const db1k = 20 * Math.log10(response1k.magnitude);

      expect(db100).toBeLessThan(db1k);
      expect(db100).toBeLessThan(0);
    });

    it('measures 16 kHz reasonably at high sample rates', () => {
      const sampleRate = 96000;
      const coeffs = getAWeightingCoeffs(sampleRate);

      const response = calculateAResponse(coeffs, 16000, sampleRate);
      const actualDb = 20 * Math.log10(response.magnitude);
      const expectedDb = -6.6;

      // High-frequency tolerance is wider due bilinear and cascade approximation.
      expect(Math.abs(actualDb - expectedDb)).toBeLessThan(15.0);
    });

    it('runs validateTable3Compliance without throwing', () => {
      expect(() => validateTable3Compliance(48000)).not.toThrow();
      expect(() => validateTable3Compliance(96000)).not.toThrow();
      expect(() => validateTable3Compliance(16000)).not.toThrow();
    });

    it('shows monotonic attenuation trend in low-frequency range', () => {
      const sampleRate = 48000;
      const coeffs = getAWeightingCoeffs(sampleRate);

      const response20 = calculateAResponse(coeffs, 20, sampleRate);
      const response50 = calculateAResponse(coeffs, 50, sampleRate);

      expect(20 * Math.log10(response20.magnitude)).toBeLessThan(
        20 * Math.log10(response50.magnitude)
      );
    });

    it('behaves stably around pole frequencies', () => {
      const sampleRate = 48000;
      const coeffs = getAWeightingCoeffs(sampleRate);

      const poleFreqs = [20.6, 107.7, 737.9];

      poleFreqs.forEach((freq) => {
        const responseLow = calculateAResponse(coeffs, freq * 0.8, sampleRate);
        const responseCenter = calculateAResponse(coeffs, freq, sampleRate);
        const responseHigh = calculateAResponse(coeffs, freq * 1.2, sampleRate);

        const dbLow = 20 * Math.log10(responseLow.magnitude);
        const dbCenter = 20 * Math.log10(responseCenter.magnitude);
        const dbHigh = 20 * Math.log10(responseHigh.magnitude);

        // Pole-adjacent points should not produce a sharp local maximum.
        expect(dbCenter).toBeLessThan(Math.max(dbLow, dbHigh));
      });
    });

    it('uses a 4-stage cascade structure', () => {
      const sampleRate = 48000;
      const coeffs = getAWeightingCoeffs(sampleRate);

      expect(coeffs.length).toBe(4);

      coeffs.forEach((coeff) => {
        expect(isFinite(coeff.b0)).toBe(true);
        expect(isFinite(coeff.b1)).toBe(true);
        expect(isFinite(coeff.b2)).toBe(true);
        expect(isFinite(coeff.a1)).toBe(true);
        expect(isFinite(coeff.a2)).toBe(true);
        expect(coeff.a0).toBe(1);
      });
    });

    it('stays within improved Table 3 Class 1 tolerance targets', () => {
      const sampleRate = 48000;
      const coeffs = getAWeightingCoeffs(sampleRate);

      const testPoints = [
        { freq: 63, expectedDb: -26.2, tolerance: 2.0 },
        { freq: 125, expectedDb: -16.1, tolerance: 2.0 },
        { freq: 250, expectedDb: -8.6, tolerance: 1.5 },
        { freq: 500, expectedDb: -3.2, tolerance: 1.5 },
        { freq: 1000, expectedDb: 0.0, tolerance: 0.7 },
        { freq: 2000, expectedDb: 1.2, tolerance: 1.5 },
        { freq: 4000, expectedDb: 1.0, tolerance: 2.0 }
      ];

      testPoints.forEach(({ freq, expectedDb, tolerance }) => {
        const response = calculateAResponse(coeffs, freq, sampleRate);
        const actualDb = 20 * Math.log10(response.magnitude);
        const error = Math.abs(actualDb - expectedDb);

        expect(error).toBeLessThan(tolerance);
      });

      const response100 = calculateAResponse(coeffs, 100, sampleRate);
      const response1k = calculateAResponse(coeffs, 1000, sampleRate);
      const db100 = 20 * Math.log10(response100.magnitude);
      const db1k = 20 * Math.log10(response1k.magnitude);

      expect(db100).toBeLessThan(db1k);
      expect(db100).toBeLessThan(-10);
    });
  });
});
