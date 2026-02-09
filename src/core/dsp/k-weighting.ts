import { AudioInspectError, BiquadCoeffs } from '../../types.js';

// Cache per-sample-rate cascaded biquad coefficients.
const kWeightingCache = new Map<number, BiquadCoeffs[]>();

function validateSampleRate(sampleRate: number): void {
  if (!isFinite(sampleRate) || sampleRate <= 0) {
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

export function designKWeighting(sampleRate: number): BiquadCoeffs[] {
  validateSampleRate(sampleRate);

  const cached = kWeightingCache.get(sampleRate);
  if (cached) {
    return cached;
  }

  const coeffs: BiquadCoeffs[] = [];

  // ITU-R BS.1770 reference coefficients for 48 kHz.
  if (sampleRate === 48000) {
    // Stage 1: shelving filter.
    coeffs.push({
      b0: 1.53512485958697,
      b1: -2.69169618940638,
      b2: 1.19839281085285,
      a0: 1,
      a1: -1.69065929318241,
      a2: 0.73248077421585
    });

    // Stage 2: high-pass filter.
    coeffs.push({
      b0: 1.0,
      b1: -2.0,
      b2: 1.0,
      a0: 1,
      a1: -1.99004745483398,
      a2: 0.99007225036621
    });
  } else {
    // Generic design for other sample rates (bilinear transform).
    // Stage 1: shelving filter.
    const f0 = 1681.9744509555319; // Hz
    const G = 3.99984385397; // dB
    const Q = 0.7071752369554193;

    const K = Math.tan((Math.PI * f0) / sampleRate);
    const Vh = Math.pow(10.0, G / 20.0);
    const Vb = Math.pow(Vh, 0.499666774155);
    const norm = 1.0 + K / Q + K * K;

    coeffs.push({
      b0: (Vh + (Vb * K) / Q + K * K) / norm,
      b1: (2.0 * (K * K - Vh)) / norm,
      b2: (Vh - (Vb * K) / Q + K * K) / norm,
      a0: 1,
      a1: (2.0 * (K * K - 1.0)) / norm,
      a2: (1.0 - K / Q + K * K) / norm
    });

    // Stage 2: high-pass filter.
    const fc = 38.13547087613982; // Hz
    const Qc = 0.5003270373253953;

    const K2 = Math.tan((Math.PI * fc) / sampleRate);
    const norm2 = 1.0 + K2 / Qc + K2 * K2;

    coeffs.push({
      b0: 1.0,
      b1: -2.0,
      b2: 1.0,
      a0: 1,
      a1: (2.0 * (K2 * K2 - 1.0)) / norm2,
      a2: (1.0 - K2 / Qc + K2 * K2) / norm2
    });

    // Normalize to unity magnitude at 997 Hz (BS.1770 convention).
    const response997 = calculateFrequencyResponse(coeffs, 997, sampleRate);
    const normGain = 1.0 / response997.magnitude;

    if (coeffs[0]) {
      coeffs[0].b0 *= normGain;
      coeffs[0].b1 *= normGain;
      coeffs[0].b2 *= normGain;
    }
  }

  kWeightingCache.set(sampleRate, coeffs);
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

    const h_stage_real = (num_real * den_real + num_imag * den_imag) / den_mag_sq;
    const h_stage_imag = (num_imag * den_real - num_real * den_imag) / den_mag_sq;

    const new_real = h_real * h_stage_real - h_imag * h_stage_imag;
    const new_imag = h_real * h_stage_imag + h_imag * h_stage_real;
    h_real = new_real;
    h_imag = new_imag;
  }

  const magnitude = Math.sqrt(h_real * h_real + h_imag * h_imag);
  const phase = Math.atan2(h_imag, h_real);

  return { magnitude, phase };
}

export function getKWeightingCoeffs(sampleRate: number): BiquadCoeffs[] {
  return designKWeighting(sampleRate);
}
