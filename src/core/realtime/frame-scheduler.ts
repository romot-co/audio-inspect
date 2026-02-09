import { AudioInspectError } from '../../types.js';

export interface ScheduledFrame {
  start: number;
  end: number;
}

export class RealtimeFrameScheduler {
  private readonly bufferSize: number;
  private readonly hopSize: number;
  private writeIndexAbs = 0;
  private analysisStartAbs = 0;

  constructor(bufferSize: number, hopSize: number) {
    if (!Number.isInteger(bufferSize) || bufferSize <= 0) {
      throw new AudioInspectError('INVALID_INPUT', 'bufferSize must be a positive integer');
    }
    if (!Number.isInteger(hopSize) || hopSize <= 0) {
      throw new AudioInspectError('INVALID_INPUT', 'hopSize must be a positive integer');
    }

    this.bufferSize = bufferSize;
    this.hopSize = hopSize;
  }

  get writeIndex(): number {
    return this.writeIndexAbs;
  }

  get nextFrameStart(): number {
    return this.analysisStartAbs;
  }

  append(sampleCount: number): ScheduledFrame[] {
    if (!Number.isInteger(sampleCount) || sampleCount < 0) {
      throw new AudioInspectError('INVALID_INPUT', 'sampleCount must be a non-negative integer');
    }
    if (sampleCount === 0) {
      return [];
    }

    this.writeIndexAbs += sampleCount;
    const frames: ScheduledFrame[] = [];

    while (this.writeIndexAbs - this.analysisStartAbs >= this.bufferSize) {
      const start = this.analysisStartAbs;
      frames.push({
        start,
        end: start + this.bufferSize
      });
      this.analysisStartAbs += this.hopSize;
    }

    return frames;
  }

  reset(): void {
    this.writeIndexAbs = 0;
    this.analysisStartAbs = 0;
  }
}
