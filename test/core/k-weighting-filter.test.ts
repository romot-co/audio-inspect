import { describe, expect, it } from 'vitest';

import {
  calculateFrequencyResponse as calculateKResponse,
  getKWeightingCoeffs
} from '../../src/core/dsp/k-weighting.js';

describe('K-weighting Filter (ITU-R BS.1770-5)', () => {
  describe('basic standards-compliance checks', () => {
    it('normalizes near 997 Hz for non-48 kHz sample rates (ITU-R BS.1770-5)', () => {
      const testRates = [44100, 88200, 96000];

      testRates.forEach((sampleRate) => {
        const coeffs = getKWeightingCoeffs(sampleRate);
        const response = calculateKResponse(coeffs, 997, sampleRate);
        const magnitudeDb = 20 * Math.log10(response.magnitude);

        // Non-48 kHz branches are normalized at 997 Hz.
        expect(Math.abs(magnitudeDb)).toBeLessThan(0.05);
      });
    });

    it('matches 48 kHz K-weighting response from official BS.1770-5 coefficients', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      // Reference points around HPF and shelf behavior.
      const testPoints = [
        { freq: 38, expectedDb: -6.0, tolerance: 1.0 },
        { freq: 100, expectedDb: -1.1, tolerance: 0.2 },
        { freq: 997, expectedDb: 0.7, tolerance: 0.1 },
        { freq: 1000, expectedDb: 0.7, tolerance: 0.1 },
        { freq: 2000, expectedDb: 3.1, tolerance: 0.2 },
        { freq: 4000, expectedDb: 4.0, tolerance: 0.1 },
        { freq: 8000, expectedDb: 4.0, tolerance: 0.2 }
      ];

      testPoints.forEach(({ freq, expectedDb, tolerance }) => {
        const response = calculateKResponse(coeffs, freq, sampleRate);
        const actualDb = 20 * Math.log10(response.magnitude);
        const error = Math.abs(actualDb - expectedDb);

        expect(error).toBeLessThan(tolerance);
      });
    });

    it('shows expected K-weighting response at other sample rates', () => {
      const testSampleRates = [44100, 96000];

      testSampleRates.forEach((sampleRate) => {
        const coeffs = getKWeightingCoeffs(sampleRate);

        // Use representative points valid below each Nyquist limit.
        const mainPoints = [
          { freq: 38, expectedDb: -6.0, tolerance: 1.5 },
          { freq: 997, expectedDb: 0.0, tolerance: 0.05 },
          { freq: 1000, expectedDb: 0.01, tolerance: 0.1 },
          { freq: 4000, expectedDb: 3.3, tolerance: 0.3 }
        ];

        mainPoints
          .filter((point) => point.freq < sampleRate / 2.5)
          .forEach(({ freq, expectedDb, tolerance }) => {
            const response = calculateKResponse(coeffs, freq, sampleRate);
            const actualDb = 20 * Math.log10(response.magnitude);
            expect(Math.abs(actualDb - expectedDb)).toBeLessThan(tolerance);
          });
      });
    });
  });

  describe('official ITU-R BS.1770-5 coefficient validation', () => {
    it('matches the 48 kHz reference coefficients', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      expect(coeffs.length).toBe(2);

      // Stage 1: high-shelf coefficients.
      const expectedStage1 = {
        b0: 1.53512485958697,
        b1: -2.69169618940638,
        b2: 1.19839281085285,
        a1: -1.69065929318241,
        a2: 0.73248077421585
      };

      expect(coeffs[0]).toBeDefined();
      if (coeffs[0]) {
        expect(coeffs[0].b0).toBeCloseTo(expectedStage1.b0, 10);
        expect(coeffs[0].b1).toBeCloseTo(expectedStage1.b1, 10);
        expect(coeffs[0].b2).toBeCloseTo(expectedStage1.b2, 10);
        expect(coeffs[0].a1).toBeCloseTo(expectedStage1.a1, 10);
        expect(coeffs[0].a2).toBeCloseTo(expectedStage1.a2, 10);
      }

      // Stage 2: high-pass coefficients.
      const expectedStage2 = {
        b0: 1.0,
        b1: -2.0,
        b2: 1.0,
        a1: -1.99004745483398,
        a2: 0.99007225036621
      };

      expect(coeffs[1]).toBeDefined();
      if (coeffs[1]) {
        expect(coeffs[1].b0).toBeCloseTo(expectedStage2.b0, 10);
        expect(coeffs[1].b1).toBeCloseTo(expectedStage2.b1, 10);
        expect(coeffs[1].b2).toBeCloseTo(expectedStage2.b2, 10);
        expect(coeffs[1].a1).toBeCloseTo(expectedStage2.a1, 10);
        expect(coeffs[1].a2).toBeCloseTo(expectedStage2.a2, 10);
      }
    });

    it('uses a 2-stage cascade structure', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      expect(coeffs.length).toBe(2);

      coeffs.forEach((coeff) => {
        expect(isFinite(coeff.b0)).toBe(true);
        expect(isFinite(coeff.b1)).toBe(true);
        expect(isFinite(coeff.b2)).toBe(true);
        expect(isFinite(coeff.a1)).toBe(true);
        expect(isFinite(coeff.a2)).toBe(true);
        expect(coeff.a0).toBe(1);
      });
    });
  });

  describe('detailed frequency-response checks', () => {
    it('verifies high-shelf filter behavior', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      const response2k = calculateKResponse(coeffs, 2000, sampleRate);
      const response4k = calculateKResponse(coeffs, 4000, sampleRate);
      const response8k = calculateKResponse(coeffs, 8000, sampleRate);

      const db2k = 20 * Math.log10(response2k.magnitude);
      const db4k = 20 * Math.log10(response4k.magnitude);
      const db8k = 20 * Math.log10(response8k.magnitude);

      expect(db2k).toBeGreaterThan(2.0);
      expect(db2k).toBeLessThan(4.0);

      // Shelf should be near-flat around 4-8 kHz.
      expect(db4k).toBeGreaterThan(3.5);
      expect(db4k).toBeLessThan(4.5);
      expect(Math.abs(db8k - db4k)).toBeLessThan(0.5);
    });

    it('verifies high-pass filter behavior', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      const response20 = calculateKResponse(coeffs, 20, sampleRate);
      const response38 = calculateKResponse(coeffs, 38, sampleRate);
      const response100 = calculateKResponse(coeffs, 100, sampleRate);

      const db20 = 20 * Math.log10(response20.magnitude);
      const db38 = 20 * Math.log10(response38.magnitude);
      const db100 = 20 * Math.log10(response100.magnitude);

      expect(db20).toBeLessThan(db38);
      expect(db38).toBeLessThan(db100);

      // Around the corner frequency, response should be close to -6 dB.
      expect(Math.abs(db38 - -6.0)).toBeLessThan(1.0);
    });

    it('validates behavior around the 1681.97 Hz shelf center', () => {
      const testSampleRates = [44100, 48000, 96000];

      testSampleRates.forEach((sampleRate) => {
        const coeffs = getKWeightingCoeffs(sampleRate);

        const responseCenter = calculateKResponse(coeffs, 1681.97, sampleRate);
        const responseLower = calculateKResponse(coeffs, 1200, sampleRate);
        const responseUpper = calculateKResponse(coeffs, 2400, sampleRate);

        const dbCenter = 20 * Math.log10(responseCenter.magnitude);
        const dbLower = 20 * Math.log10(responseLower.magnitude);
        const dbUpper = 20 * Math.log10(responseUpper.magnitude);

        expect(dbCenter).toBeGreaterThan(1.5);
        expect(dbCenter).toBeLessThan(3.0);

        expect(dbLower).toBeLessThan(dbCenter);
        expect(dbUpper).toBeGreaterThan(dbCenter);
      });
    });
  });

  describe('numerical stability and error handling', () => {
    it('supports non-integer sample rates', () => {
      const nonIntegerRate = 44056.5;

      expect(() => {
        const coeffs = getKWeightingCoeffs(nonIntegerRate);
        const response = calculateKResponse(coeffs, 1000, nonIntegerRate);
        const db = 20 * Math.log10(response.magnitude);
        expect(Math.abs(db)).toBeLessThan(0.1);
      }).not.toThrow();
    });

    it('keeps filter coefficients numerically stable (BS.1770-5 requirement)', () => {
      const validRates = [8000, 44100, 48000, 96000, 192000, 384000];

      validRates.forEach((sampleRate) => {
        const kCoeffs = getKWeightingCoeffs(sampleRate);

        kCoeffs.forEach((coeff) => {
          // All coefficients should remain finite.
          expect(isFinite(coeff.b0)).toBe(true);
          expect(isFinite(coeff.b1)).toBe(true);
          expect(isFinite(coeff.b2)).toBe(true);
          expect(isFinite(coeff.a1)).toBe(true);
          expect(isFinite(coeff.a2)).toBe(true);

          // Coefficients should stay within a practical numeric range.
          expect(Math.abs(coeff.b0)).toBeLessThan(10);
          expect(Math.abs(coeff.b1)).toBeLessThan(10);
          expect(Math.abs(coeff.b2)).toBeLessThan(10);
          expect(Math.abs(coeff.a1)).toBeLessThan(3);
          expect(Math.abs(coeff.a2)).toBeLessThan(2);
        });
      });
    });

    it('throws for out-of-spec sample rates', () => {
      const invalidRates = [7999, 384001, 0, -1, NaN, Infinity];

      invalidRates.forEach((sampleRate) => {
        expect(() => getKWeightingCoeffs(sampleRate)).toThrow();
      });
    });

    it('avoids division-by-zero failures', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      expect(() => {
        const response = calculateKResponse(coeffs, 0.001, sampleRate);
        expect(isFinite(response.magnitude)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Nyquist-limit compliance checks', () => {
    it('keeps reference measurement frequencies within 80% of Nyquist', () => {
      const lowSampleRates = [8000, 16000, 22050];

      lowSampleRates.forEach((sampleRate) => {
        const nyquist = sampleRate / 2;
        const maxTestFreq = nyquist * 0.8;

        expect(maxTestFreq).toBeLessThan(nyquist);

        if (maxTestFreq >= 1000) {
          const coeffs = getKWeightingCoeffs(sampleRate);
          const response = calculateKResponse(coeffs, 1000, sampleRate);
          expect(isFinite(response.magnitude)).toBe(true);
        }
      });
    });

    it('behaves safely when measuring above Nyquist', () => {
      const sampleRate = 16000; // Nyquist = 8 kHz
      const coeffs = getKWeightingCoeffs(sampleRate);

      expect(() => {
        const response = calculateKResponse(coeffs, 10000, sampleRate);
        expect(isFinite(response.magnitude)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('standards-compliant cache behavior', () => {
    it('returns consistent results for identical sample rates (spec requirement)', () => {
      const sampleRate = 48000;

      const kCoeffs1 = getKWeightingCoeffs(sampleRate);
      const kCoeffs2 = getKWeightingCoeffs(sampleRate);

      expect(kCoeffs1).toStrictEqual(kCoeffs2);

      const kResponse1 = calculateKResponse(kCoeffs1, 1000, sampleRate);
      const kResponse2 = calculateKResponse(kCoeffs2, 1000, sampleRate);
      expect(kResponse1.magnitude).toBe(kResponse2.magnitude);
    });
  });

  describe('monotonic frequency-response checks', () => {
    it('has appropriate attenuation in the low-frequency range', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      const response10 = calculateKResponse(coeffs, 10, sampleRate);
      const response20 = calculateKResponse(coeffs, 20, sampleRate);
      const response38 = calculateKResponse(coeffs, 38, sampleRate);

      expect(20 * Math.log10(response10.magnitude)).toBeLessThan(
        20 * Math.log10(response20.magnitude)
      );
      expect(20 * Math.log10(response20.magnitude)).toBeLessThan(
        20 * Math.log10(response38.magnitude)
      );
    });

    it('shows expected shelf behavior in the high-frequency range', () => {
      const sampleRate = 48000;
      const coeffs = getKWeightingCoeffs(sampleRate);

      const response4k = calculateKResponse(coeffs, 4000, sampleRate);
      const response8k = calculateKResponse(coeffs, 8000, sampleRate);
      const response12k = calculateKResponse(coeffs, 12000, sampleRate);

      const db4k = 20 * Math.log10(response4k.magnitude);
      const db8k = 20 * Math.log10(response8k.magnitude);
      const db12k = 20 * Math.log10(response12k.magnitude);

      expect(Math.abs(db8k - db4k)).toBeLessThan(0.5);
      expect(Math.abs(db12k - db4k)).toBeLessThan(0.8);
    });
  });
});
