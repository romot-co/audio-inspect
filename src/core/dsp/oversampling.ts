import { AudioInspectError } from '../../types.js';

export interface OversamplingOptions {
  factor?: number;
  interpolation?: 'linear' | 'cubic' | 'sinc';
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

// Estimate inter-sample true peak by interpolation.
export function getTruePeak(samples: Float32Array, options: OversamplingOptions = {}): number {
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
