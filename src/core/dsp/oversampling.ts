import { AudioInspectError } from '../../types.js';

export interface OversamplingOptions {
  factor?: number;
  interpolation?: 'linear' | 'cubic' | 'sinc';
}

export interface TruePeakOptions {
  /**
   * BS.1770 Annex 2 polyphase FIR coefficients are defined for 4x.
   * 2x reuses every other phase from the same table.
   */
  factor?: 2 | 4;
}

// Keep supported factors explicit to match tested quality/performance bounds.
function validateFactor(factor: number): void {
  if (![2, 4, 8].includes(factor)) {
    throw new AudioInspectError(
      'INVALID_INPUT',
      'Oversampling factor must be 2, 4, or 8. Sinc interpolation quality is not guaranteed for other values.'
    );
  }
}

// Piecewise linear interpolation.
function linearOversample(samples: Float32Array, factor: number): Float32Array {
  const outputLength = (samples.length - 1) * factor + 1;
  const output = new Float32Array(outputLength);

  for (let i = 0; i < samples.length - 1; i++) {
    const start = samples[i]!;
    const end = samples[i + 1]!;
    const step = (end - start) / factor;

    for (let j = 0; j < factor; j++) {
      output[i * factor + j] = start + step * j;
    }
  }

  if (samples.length > 0) {
    output[outputLength - 1] = samples[samples.length - 1]!;
  }

  return output;
}

// Cubic interpolation (Catmull-Rom style neighborhood).
function cubicOversample(samples: Float32Array, factor: number): Float32Array {
  if (samples.length < 4) {
    return linearOversample(samples, factor);
  }

  const outputLength = (samples.length - 1) * factor + 1;
  const output = new Float32Array(outputLength);

  for (let i = 0; i < samples.length - 1; i++) {
    const p0 = samples[Math.max(0, i - 1)]!;
    const p1 = samples[i]!;
    const p2 = samples[Math.min(samples.length - 1, i + 1)]!;
    const p3 = samples[Math.min(samples.length - 1, i + 2)]!;

    for (let j = 0; j < factor; j++) {
      const t = j / factor;
      const t2 = t * t;
      const t3 = t2 * t;
      output[i * factor + j] =
        0.5 *
        (2 * p1 +
          (-p0 + p2) * t +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
          (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
  }

  if (samples.length > 0) {
    output[outputLength - 1] = samples[samples.length - 1]!;
  }

  return output;
}

// Windowed-sinc interpolation with a small fixed kernel.
function sincOversample(samples: Float32Array, factor: number): Float32Array {
  const outputLength = (samples.length - 1) * factor + 1;
  const output = new Float32Array(outputLength);

  const sincFunction = (x: number): number => {
    if (Math.abs(x) < 1e-10) return 1;
    const piX = Math.PI * x;
    return Math.abs(x) < 3 ? (3 * Math.sin(piX / 3) * Math.sin(piX)) / (piX * piX) : 0;
  };

  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i / factor;
    let value = 0;

    for (let j = -3; j <= 3; j++) {
      const sampleIndex = Math.floor(sourceIndex) + j;
      if (sampleIndex >= 0 && sampleIndex < samples.length) {
        value += samples[sampleIndex]! * sincFunction(sourceIndex - sampleIndex);
      }
    }

    output[i] = value;
  }

  return output;
}

// Upsample waveform for analysis/visualization.
export function oversample(samples: Float32Array, options: OversamplingOptions = {}): Float32Array {
  const { factor = 4, interpolation = 'cubic' } = options;
  validateFactor(factor);

  if (factor <= 1) {
    return samples;
  }
  if (samples.length === 0) {
    return new Float32Array(0);
  }

  switch (interpolation) {
    case 'linear':
      return linearOversample(samples, factor);
    case 'cubic':
      return cubicOversample(samples, factor);
    case 'sinc':
      return sincOversample(samples, factor);
    default:
      return cubicOversample(samples, factor);
  }
}

// Estimate inter-sample peak by interpolation.
export function getInterSamplePeak(samples: Float32Array, options: OversamplingOptions = {}): number {
  if (samples.length === 0) {
    return 0;
  }

  const { factor = 4, interpolation = 'cubic' } = options;
  validateFactor(factor);

  let peak = 0;
  if (factor <= 1 || samples.length === 1) {
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.abs(samples[i]!);
      if (sample > peak) {
        peak = sample;
      }
    }
    return peak;
  }

  if (interpolation === 'sinc') {
    // Inline sinc path avoids allocating a full oversampled buffer.
    const sincFunction = (x: number): number => {
      if (Math.abs(x) < 1e-10) return 1;
      const piX = Math.PI * x;
      return Math.abs(x) < 3 ? (3 * Math.sin(piX / 3) * Math.sin(piX)) / (piX * piX) : 0;
    };

    const outputLength = (samples.length - 1) * factor + 1;
    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i / factor;
      let value = 0;
      for (let j = -3; j <= 3; j++) {
        const sampleIndex = Math.floor(sourceIndex) + j;
        if (sampleIndex >= 0 && sampleIndex < samples.length) {
          value += samples[sampleIndex]! * sincFunction(sourceIndex - sampleIndex);
        }
      }
      const absValue = Math.abs(value);
      if (absValue > peak) {
        peak = absValue;
      }
    }
    return peak;
  }

  for (let i = 0; i < samples.length - 1; i++) {
    const p1 = samples[i]!;
    const p2 = samples[i + 1]!;
    let p0 = p1;
    let p3 = p2;

    if (interpolation === 'cubic') {
      p0 = samples[Math.max(0, i - 1)]!;
      p3 = samples[Math.min(samples.length - 1, i + 2)]!;
    }

    for (let j = 0; j < factor; j++) {
      const t = j / factor;
      const value =
        interpolation === 'linear'
          ? p1 + (p2 - p1) * t
          : 0.5 *
            (2 * p1 +
              (-p0 + p2) * t +
              (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
              (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
      const absValue = Math.abs(value);
      if (absValue > peak) {
        peak = absValue;
      }
    }
  }

  const lastAbs = Math.abs(samples[samples.length - 1]!);
  if (lastAbs > peak) {
    peak = lastAbs;
  }

  return peak;
}

// ITU-R BS.1770-5 Annex 2, Table 3 (48-tap, 4-phase polyphase FIR).
// Coefficients are arranged per phase and consumed with the most recent
// sample first (delay index 0..11).
const BS1770_PHASE_FILTERS_4X: readonly (readonly number[])[] = Object.freeze([
  Object.freeze([
    0.001708984375,
    0.010986328125,
    -0.0196533203125,
    0.033203125,
    -0.0594482421875,
    0.1373291015625,
    0.97216796875,
    -0.102294921875,
    0.047607421875,
    -0.026611328125,
    0.014892578125,
    -0.00830078125
  ]),
  Object.freeze([
    -0.0291748046875,
    0.029296875,
    -0.0517578125,
    0.089111328125,
    -0.16650390625,
    0.465087890625,
    0.77978515625,
    -0.2003173828125,
    0.1015625,
    -0.0582275390625,
    0.0330810546875,
    -0.0189208984375
  ]),
  Object.freeze([
    -0.0189208984375,
    0.0330810546875,
    -0.0582275390625,
    0.1015625,
    -0.2003173828125,
    0.77978515625,
    0.465087890625,
    -0.16650390625,
    0.089111328125,
    -0.0517578125,
    0.029296875,
    -0.0291748046875
  ]),
  Object.freeze([
    -0.00830078125,
    0.014892578125,
    -0.026611328125,
    0.047607421875,
    -0.102294921875,
    0.97216796875,
    0.1373291015625,
    -0.0594482421875,
    0.033203125,
    -0.0196533203125,
    0.010986328125,
    0.001708984375
  ])
]);

function validateTruePeakFactor(factor: number): asserts factor is 2 | 4 {
  if (factor !== 2 && factor !== 4) {
    throw new AudioInspectError(
      'INVALID_INPUT',
      'BS.1770 true peak supports oversampling factor 2 or 4'
    );
  }
}

function computeSamplePeak(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const absValue = Math.abs(samples[i]!);
    if (absValue > peak) {
      peak = absValue;
    }
  }
  return peak;
}

function computePolyphasePeak(samples: Float32Array, phases: readonly number[]): number {
  const firstPhase = BS1770_PHASE_FILTERS_4X[0];
  if (!firstPhase || firstPhase.length === 0) {
    return 0;
  }
  const delayLength = firstPhase.length;

  const delay = new Float64Array(delayLength);
  let writeIndex = 0;
  let peak = 0;

  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
    delay[writeIndex] = samples[sampleIndex]!;

    for (const phase of phases) {
      const filter = BS1770_PHASE_FILTERS_4X[phase];
      if (!filter) {
        continue;
      }
      let acc = 0;
      for (let tap = 0; tap < delayLength; tap++) {
        let delayIndex = writeIndex - tap;
        if (delayIndex < 0) {
          delayIndex += delayLength;
        }
        acc += delay[delayIndex]! * filter[tap]!;
      }

      const absValue = Math.abs(acc);
      if (absValue > peak) {
        peak = absValue;
      }
    }

    writeIndex = (writeIndex + 1) % delayLength;
  }

  return peak;
}

/**
 * ITU-R BS.1770 Annex 2 true-peak estimator using a polyphase FIR.
 * Returns absolute linear peak (convert to dBTP with ampToDb(..., 1)).
 */
export function getTruePeak(samples: Float32Array, options: TruePeakOptions = {}): number {
  if (samples.length === 0) {
    return 0;
  }

  const factor = options.factor ?? 4;
  validateTruePeakFactor(factor);

  // Always include original sample peak to avoid under-reading due to filter approximation.
  let peak = computeSamplePeak(samples);

  const phases = factor === 2 ? [0, 2] : [0, 1, 2, 3];
  const polyphasePeak = computePolyphasePeak(samples, phases);
  if (polyphasePeak > peak) {
    peak = polyphasePeak;
  }

  return peak;
}
