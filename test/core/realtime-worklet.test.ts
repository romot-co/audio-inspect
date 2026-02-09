import { describe, expect, it, vi } from 'vitest';
import { prepareWorklet } from '../../src/core/realtime/worklet.js';

describe('core/realtime-worklet', () => {
  it('throws WORKLET_NOT_SUPPORTED when context has no audioWorklet', async () => {
    const context = {} as BaseAudioContext;

    await expect(prepareWorklet(context)).rejects.toMatchObject({
      code: 'WORKLET_NOT_SUPPORTED'
    });
  });

  it('throws MODULE_LOAD_FAILED when addModule fails', async () => {
    const addModule = vi.fn(async () => {
      throw new Error('module load failed');
    });
    const context = {
      audioWorklet: { addModule }
    } as unknown as BaseAudioContext;

    await expect(prepareWorklet(context, { moduleUrl: '/bad-module.js' })).rejects.toMatchObject({
      code: 'MODULE_LOAD_FAILED'
    });
  });
});
