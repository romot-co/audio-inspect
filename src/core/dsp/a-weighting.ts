import { AudioInspectError, BiquadCoeffs } from '../../types.js';
import { ampToDb } from './db.js';

// Cache per-sample-rate cascaded biquad coefficients.
const aWeightingCache = new Map<number, BiquadCoeffs[]>();

interface BiquadState {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export function getAWeightingCoeffs(sampleRate: number): BiquadCoeffs[] {
  return designAWeighting(sampleRate);
}

function validateSampleRate(sampleRate: number): void {
  if (sampleRate <= 0 || !isFinite(sampleRate)) {
    throw new AudioInspectError('INVALID_INPUT', 'Sample rate must be a positive finite value');
  }

  // Keep range constrained to typical production sample rates.
  if (sampleRate < 8000 || sampleRate > 384000) {
    throw new AudioInspectError(
      'UNSUPPORTED_FORMAT',
      `Sample rate ${sampleRate} Hz is not supported`
    );
  }
}

export function designAWeighting(sampleRate: number): BiquadCoeffs[] {
  validateSampleRate(sampleRate);

  const cached = aWeightingCache.get(sampleRate);
  if (cached) {
    return cached;
  }

  // IEC 61672 analog A-weighting corner frequencies (Hz).
  const f1 = 20.598997;
  const f2 = 107.65265;
  const f3 = 737.86223;
  const f4 = 12194.217;

  // Nominal gain at 1 kHz in dB for analog prototype.
  const A1000 = 1.9997;
  const coeffs: BiquadCoeffs[] = [];

  // Bilinear pre-warping.
  const w1_prime = 2 * sampleRate * Math.tan((Math.PI * f1) / sampleRate);
  const w2_prime = 2 * sampleRate * Math.tan((Math.PI * f2) / sampleRate);
  const w3_prime = 2 * sampleRate * Math.tan((Math.PI * f3) / sampleRate);
  const w4_prime = 2 * sampleRate * Math.tan((Math.PI * f4) / sampleRate);

  // Convert dB gain to linear amplitude.
  const GA = Math.pow(10, A1000 / 20);

  // Stage 1: second-order high-pass section near f1.
  {
    const w = w1_prime;
    const w2 = w * w;
    const sqrt2 = Math.SQRT2;

    const a0 = 4 * sampleRate * sampleRate + 2 * sqrt2 * w * sampleRate + w2;
    const a1 = (2 * (w2 - 4 * sampleRate * sampleRate)) / a0;
    const a2 = (4 * sampleRate * sampleRate - 2 * sqrt2 * w * sampleRate + w2) / a0;

    coeffs.push({
      b0: (4 * sampleRate * sampleRate * GA) / a0,
      b1: (-8 * sampleRate * sampleRate * GA) / a0,
      b2: (4 * sampleRate * sampleRate * GA) / a0,
      a0: 1,
      a1: a1,
      a2: a2
    });
  }

  // Stage 2: first-order high-pass section near f2.
  {
    const w = w2_prime;
    const a0 = 2 * sampleRate + w;
    const a1 = (w - 2 * sampleRate) / a0;

    coeffs.push({
      b0: (2 * sampleRate) / a0,
      b1: (-2 * sampleRate) / a0,
      b2: 0,
      a0: 1,
      a1: a1,
      a2: 0
    });
  }

  // Stage 3: first-order high-pass section near f3.
  {
    const w = w3_prime;
    const a0 = 2 * sampleRate + w;
    const a1 = (w - 2 * sampleRate) / a0;

    coeffs.push({
      b0: (2 * sampleRate) / a0,
      b1: (-2 * sampleRate) / a0,
      b2: 0,
      a0: 1,
      a1: a1,
      a2: 0
    });
  }

  // Stage 4: second-order low-pass section near f4.
  {
    const w = w4_prime;
    const w2 = w * w;
    const sqrt2 = Math.SQRT2;

    const a0 = 4 * sampleRate * sampleRate + 2 * sqrt2 * w * sampleRate + w2;
    const a1 = (2 * (w2 - 4 * sampleRate * sampleRate)) / a0;
    const a2 = (4 * sampleRate * sampleRate - 2 * sqrt2 * w * sampleRate + w2) / a0;

    coeffs.push({
      b0: w2 / a0,
      b1: (2 * w2) / a0,
      b2: w2 / a0,
      a0: 1,
      a1: a1,
      a2: a2
    });
  }

  // Normalize the cascaded response to unity at 1 kHz.
  const response1k = calculateFrequencyResponse(coeffs, 1000, sampleRate);
  const normalizeGain = 1.0 / response1k.magnitude;

  coeffs.forEach((coeff) => {
    coeff.b0 *= normalizeGain;
    coeff.b1 *= normalizeGain;
    coeff.b2 *= normalizeGain;
  });

  aWeightingCache.set(sampleRate, coeffs);
  return coeffs;
}

export function calculateFrequencyResponse(
  coeffs: BiquadCoeffs[],
  frequency: number,
  sampleRate: number
): { magnitude: number; phase: number } {
  const omega = (2 * Math.PI * frequency) / sampleRate;

  let h_real = 1.0;
  let h_imag = 0.0;

  for (const coeff of coeffs) {
    const cos_omega = Math.cos(omega);
    const sin_omega = Math.sin(omega);
    const cos_2omega = Math.cos(2 * omega);
    const sin_2omega = Math.sin(2 * omega);

    const num_real = coeff.b0 + coeff.b1 * cos_omega + coeff.b2 * cos_2omega;
    const num_imag = -coeff.b1 * sin_omega - coeff.b2 * sin_2omega;

    const den_real = coeff.a0 + coeff.a1 * cos_omega + coeff.a2 * cos_2omega;
    const den_imag = -coeff.a1 * sin_omega - coeff.a2 * sin_2omega;

    const den_mag_sq = den_real * den_real + den_imag * den_imag;
    if (den_mag_sq === 0) {
      throw new AudioInspectError('INVALID_INPUT', 'Division by zero occurred while calculating frequency response');
    }

    const stage_real = (num_real * den_real + num_imag * den_imag) / den_mag_sq;
    const stage_imag = (num_imag * den_real - num_real * den_imag) / den_mag_sq;

    const temp_real = h_real * stage_real - h_imag * stage_imag;
    const temp_imag = h_real * stage_imag + h_imag * stage_real;

    h_real = temp_real;
    h_imag = temp_imag;
  }

  const magnitude = Math.sqrt(h_real * h_real + h_imag * h_imag);
  const phase = Math.atan2(h_imag, h_real);

  return { magnitude, phase };
}

function applyBiquadInPlace(
  samples: Float32Array,
  coeffs: BiquadCoeffs,
  state: BiquadState = { x1: 0, x2: 0, y1: 0, y2: 0 }
): void {
  let { x1, x2, y1, y2 } = state;

  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i]!;
    const y0 = coeffs.b0 * x0 + coeffs.b1 * x1 + coeffs.b2 * x2 - coeffs.a1 * y1 - coeffs.a2 * y2;
    samples[i] = y0;

    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  state.x1 = x1;
  state.x2 = x2;
  state.y1 = y1;
  state.y2 = y2;
}

export function applyAWeighting(samples: Float32Array, sampleRate: number): Float32Array {
  const coeffs = designAWeighting(sampleRate);
  const filtered = samples.slice();
  for (const coeff of coeffs) {
    applyBiquadInPlace(filtered, coeff);
  }
  return filtered;
}

export function validateTable3Compliance(sampleRate: number): boolean {
  const coeffs = designAWeighting(sampleRate);

  // IEC 61672-1 Table 3 reference points (Class 1 tolerance).
  const testPoints = [
    { freq: 31.5, expectedDb: -39.4, toleranceClass1: 2.0 },
    { freq: 63, expectedDb: -26.2, toleranceClass1: 1.5 },
    { freq: 125, expectedDb: -16.1, toleranceClass1: 1.5 },
    { freq: 250, expectedDb: -8.6, toleranceClass1: 1.4 },
    { freq: 500, expectedDb: -3.2, toleranceClass1: 1.3 },
    { freq: 1000, expectedDb: 0.0, toleranceClass1: 0.7 },
    { freq: 2000, expectedDb: 1.2, toleranceClass1: 1.2 },
    { freq: 4000, expectedDb: 1.0, toleranceClass1: 1.4 },
    { freq: 8000, expectedDb: -1.1, toleranceClass1: 1.6 },
    { freq: 16000, expectedDb: -6.6, toleranceClass1: 3.0 }
  ];

  const nyquist = sampleRate / 2;

  return testPoints
    .filter((point) => point.freq < nyquist * 0.8)
    .every(({ freq, expectedDb, toleranceClass1 }) => {
      const response = calculateFrequencyResponse(coeffs, freq, sampleRate);
      const actualDb = ampToDb(response.magnitude, 1);
      const error = Math.abs(actualDb - expectedDb);

      return error <= toleranceClass1;
    });
}
