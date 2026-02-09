import { describe, expect, it } from 'vitest';
import { RealtimeFrameScheduler } from '../../src/core/realtime/frame-scheduler.js';

describe('core/realtime/frame-scheduler', () => {
  it('emits frame starts at exact hop boundaries', () => {
    const scheduler = new RealtimeFrameScheduler(1024, 512);

    expect(scheduler.append(256)).toEqual([]);
    expect(scheduler.append(256)).toEqual([]);
    expect(scheduler.append(512).map((frame) => frame.start)).toEqual([0]);
    expect(scheduler.append(512).map((frame) => frame.start)).toEqual([512]);
    expect(scheduler.append(1024).map((frame) => frame.start)).toEqual([1024, 1536]);
  });

  it('resets internal absolute indices', () => {
    const scheduler = new RealtimeFrameScheduler(512, 256);
    scheduler.append(1024);
    scheduler.reset();

    const starts = scheduler.append(512).map((frame) => frame.start);
    expect(starts).toEqual([0]);
  });
});
