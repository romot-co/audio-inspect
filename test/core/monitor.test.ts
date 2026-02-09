import { afterEach, describe, expect, it, vi } from 'vitest';
import { monitor } from '../../src/core/realtime/monitor.js';

class FakeAudioWorkletNode {
  static lastOptions: AudioWorkletNodeOptions | undefined;
  static lastInstance: FakeAudioWorkletNode | null = null;

  public readonly port = {
    postMessage: vi.fn(),
    close: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null
  };

  constructor(_context: BaseAudioContext, _name: string, options?: AudioWorkletNodeOptions) {
    FakeAudioWorkletNode.lastOptions = options;
    FakeAudioWorkletNode.lastInstance = this;
  }

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
  FakeAudioWorkletNode.lastOptions = undefined;
  FakeAudioWorkletNode.lastInstance = null;
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

  it('returns a defensive copy from session.features', async () => {
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
    const context = createFakeContext(true);
    const session = await monitor({
      context,
      features: { rms: true }
    });

    const exposed = session.features as Set<string>;
    exposed.clear();

    expect(session.features.has('rms')).toBe(true);
    await session.close();
  });

  it('passes realtime policy config to the worklet', async () => {
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
    const context = createFakeContext(true);
    const session = await monitor({
      context,
      features: { rms: true },
      realtimePolicy: 'warn',
      heavyFeatureInterval: 6
    });

    const processorOptions = FakeAudioWorkletNode.lastOptions?.processorOptions as
      | Record<string, unknown>
      | undefined;
    expect(processorOptions?.realtimePolicy).toBe('warn');
    expect(processorOptions?.heavyFeatureInterval).toBe(6);

    await session.close();
  });

  it('rejects invalid heavyFeatureInterval', async () => {
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
    const context = createFakeContext(true);
    await expect(
      monitor({
        context,
        features: { rms: true },
        heavyFeatureInterval: 0
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('filters heavy features when realtimePolicy is strict', async () => {
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
    const context = createFakeContext(true);
    const session = await monitor({
      context,
      features: { rms: true, mfcc: true },
      realtimePolicy: 'strict'
    });

    expect(session.features.has('rms')).toBe(true);
    expect(session.features.has('mfcc')).toBe(false);

    await session.setFeature('mfcc', true);
    expect(session.features.has('mfcc')).toBe(false);

    const postedMessages = FakeAudioWorkletNode.lastInstance?.port.postMessage.mock.calls ?? [];
    const latestSetFeaturesMessage = [...postedMessages]
      .reverse()
      .find((call) => (call[0] as Record<string, unknown>)?.type === 'setFeatures');
    expect(latestSetFeaturesMessage).toBeDefined();
    const latestFeatures = (latestSetFeaturesMessage?.[0] as Record<string, unknown>)?.features as
      | Record<string, unknown>
      | undefined;
    expect(latestFeatures?.mfcc).toBeUndefined();

    await session.close();
  });

  it('emits realtime policy warning events when strict mode rejects heavy features', async () => {
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
    const context = createFakeContext(true);
    const session = await monitor({
      context,
      features: { rms: true },
      realtimePolicy: 'strict'
    });

    const onError = vi.fn();
    const dispose = session.onError(onError);
    await session.setFeature('mfcc', true);

    expect(onError).toHaveBeenCalledTimes(1);
    const warning = onError.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(warning.code).toBe('REALTIME_POLICY_WARNING');

    dispose();
    await session.close();
  });
});
