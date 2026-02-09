import { afterEach, describe, expect, it, vi } from 'vitest';
import { monitor } from '../../src/core/realtime/monitor.js';

class FakeAudioWorkletNode {
  public readonly port = {
    postMessage: vi.fn(),
    close: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null
  };

  constructor(_context: BaseAudioContext, _name: string, _options?: AudioWorkletNodeOptions) {}

  connect(): this {
    return this;
  }

  disconnect(): this {
    return this;
  }
}

function createFakeNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 }
  };
}

function createFakeContext(withWorklet = true): BaseAudioContext {
  const destination = createFakeNode();
  const base = {
    sampleRate: 48000,
    currentTime: 0,
    destination: destination as unknown as AudioDestinationNode,
    createGain: vi.fn(() => createFakeNode() as unknown as GainNode),
    ...(withWorklet
      ? {
          audioWorklet: {
            addModule: vi.fn(async () => undefined)
          }
        }
      : {})
  } as Partial<BaseAudioContext> & Record<string, unknown>;

  return base as BaseAudioContext;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('core/monitor', () => {
  it('throws WORKLET_NOT_SUPPORTED when context has no audioWorklet', async () => {
    const context = createFakeContext(false);
    await expect(
      monitor({
        context,
        features: { rms: true }
      })
    ).rejects.toMatchObject({ code: 'WORKLET_NOT_SUPPORTED' });
  });

  it('throws INVALID_STATE after close()', async () => {
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
    const context = createFakeContext(true);
    const session = await monitor({
      context,
      features: { rms: true }
    });

    await session.close();

    await expect(session.setFeature('peak', true)).rejects.toMatchObject({
      code: 'INVALID_STATE'
    });
  });
});
