import { describe, expect, it, vi } from 'vitest';
import { monitor } from '../../src/core/monitor.js';

function createFakeNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 }
  };
}

function createFakeContext(): BaseAudioContext {
  const destination = createFakeNode();
  return {
    sampleRate: 48000,
    currentTime: 0,
    destination: destination as unknown as AudioDestinationNode,
    createGain: vi.fn(() => createFakeNode() as unknown as GainNode),
    createScriptProcessor: vi.fn(
      () =>
        ({
          connect: vi.fn(),
          disconnect: vi.fn(),
          onaudioprocess: null
        }) as unknown as ScriptProcessorNode
    )
  } as unknown as BaseAudioContext;
}

describe('core/monitor', () => {
  it('throws INVALID_STATE after close()', async () => {
    const context = createFakeContext();
    const session = await monitor({
      context,
      engine: 'main-thread',
      features: { rms: true }
    });

    await session.close();

    await expect(session.setFeature('peak', true)).rejects.toMatchObject({
      code: 'INVALID_STATE'
    });
  });
});

