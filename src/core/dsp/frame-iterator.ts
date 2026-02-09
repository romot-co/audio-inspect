import { AudioInspectError } from '../../types.js';

export interface FrameIterationContext {
  frame: Float32Array;
  startSample: number;
  timeSec: number;
  frameIndex: number;
}

export interface FrameIterationOptions {
  samples: Float32Array;
  frameSize: number;
  hopSize: number;
  sampleRate: number;
  padEnd?: boolean;
}

export function forEachFrame(
  options: FrameIterationOptions,
  callback: (context: FrameIterationContext) => void
): number {
  const { samples, frameSize, hopSize, sampleRate, padEnd = true } = options;

  if (!Number.isInteger(frameSize) || frameSize <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'frameSize must be a positive integer');
  }
  if (!Number.isInteger(hopSize) || hopSize <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'hopSize must be a positive integer');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'sampleRate must be positive');
  }

  if (samples.length === 0) {
    return 0;
  }

  const frame = new Float32Array(frameSize);
  let frameIndex = 0;
  let start = 0;

  while (start < samples.length || (frameIndex === 0 && padEnd)) {
    const end = Math.min(start + frameSize, samples.length);
    const available = Math.max(0, end - start);

    if (available < frameSize && !padEnd && frameIndex > 0) {
      break;
    }

    frame.fill(0);
    if (available > 0) {
      frame.set(samples.subarray(start, end), 0);
    }

    callback({
      frame,
      frameIndex,
      startSample: start,
      timeSec: (start + frameSize / 2) / sampleRate
    });

    frameIndex += 1;
    start += hopSize;
    if (!padEnd && start + frameSize > samples.length) {
      break;
    }
    if (available < frameSize && padEnd) {
      break;
    }
  }

  return frameIndex;
}
