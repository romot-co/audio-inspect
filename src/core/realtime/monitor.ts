import {
  normalizeFeatureInput,
  type FeatureId,
  type FeatureInput,
  type FeatureOptions,
  type FeatureResult,
  type FeatureSelection,
  type SelectedFeatureIds
} from '../feature-registry.js';
import { prepareWorklet, type PrepareWorkletOptions } from './worklet.js';
import { AudioInspectError } from '../../types.js';
import {
  cloneFeatureSelection,
  type WorkletErrorMessage,
  type WorkletFrameMessage,
  type WorkletOutboundMessage
} from './messages.js';

export type MonitorSource = AudioNode | MediaStream | HTMLMediaElement;
export type MonitorState = 'idle' | 'running' | 'suspended' | 'closed';
export type MonitorEngine = 'worklet';

export interface MonitorOptions<F extends FeatureInput = FeatureInput> {
  context: BaseAudioContext;
  features: F;
  source?: MonitorSource;
  autoAttach?: boolean;
  worklet?: PrepareWorkletOptions;
  bufferSize?: number;
  hopSize?: number;
  inputChannelCount?: number;
  output?: 'none' | 'destination' | AudioNode;
  emit?: 'hop' | 'raf' | number;
}

export interface MonitorFrame<T extends FeatureId = FeatureId> {
  timestamp: number;
  results: Partial<{ [K in T]: FeatureResult<K> }>;
}

export interface MonitorErrorEvent {
  code: string;
  message: string;
  cause?: unknown;
  recoverable?: boolean;
}

export interface MonitorSession<T extends FeatureId = FeatureId> {
  readonly state: MonitorState;
  readonly engine: MonitorEngine;
  readonly features: ReadonlySet<FeatureId>;
  readonly node: AudioNode;

  setFeature<K extends FeatureId>(feature: K, options?: FeatureOptions<K> | true): Promise<void>;
  removeFeature(feature: FeatureId): Promise<void>;
  setFeatures<K extends FeatureId>(features: FeatureSelection<K>): Promise<void>;

  read(): MonitorFrame<T> | null;
  readFeature<K extends FeatureId>(feature: K): FeatureResult<K> | undefined;

  onFrame(handler: (frame: MonitorFrame<T>) => void): () => void;
  onError(handler: (event: MonitorErrorEvent) => void): () => void;

  attach(source: MonitorSource): void;
  detach(source?: MonitorSource): void;

  suspend(): Promise<void>;
  resume(): Promise<void>;
  close(): Promise<void>;
}

type InternalSourceRecord = {
  source: MonitorSource;
  sourceNode: AudioNode;
  outputNode: AudioNode | undefined;
};

function isMediaStream(value: MonitorSource): value is MediaStream {
  return typeof MediaStream !== 'undefined' && value instanceof MediaStream;
}

function isHtmlMediaElement(value: MonitorSource): value is HTMLMediaElement {
  return typeof HTMLMediaElement !== 'undefined' && value instanceof HTMLMediaElement;
}

function hasMediaStreamSourceFactory(context: BaseAudioContext): context is AudioContext {
  return 'createMediaStreamSource' in context;
}

function hasMediaElementSourceFactory(context: BaseAudioContext): context is AudioContext {
  return 'createMediaElementSource' in context;
}

function cloneResults<T extends FeatureId>(
  results: Partial<{ [K in T]: FeatureResult<K> }>
): Partial<{ [K in T]: FeatureResult<K> }> {
  return { ...results };
}

function nextMicrotask(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

export async function monitor<const F extends FeatureInput>(
  options: MonitorOptions<F>
): Promise<MonitorSession<SelectedFeatureIds<F>>> {
  const {
    context,
    source,
    autoAttach = source !== undefined,
    bufferSize = 1024,
    hopSize = 512,
    inputChannelCount = 1,
    emit = 'hop'
  } = options;

  await prepareWorklet(context, options.worklet);

  if (typeof AudioWorkletNode === 'undefined') {
    throw new AudioInspectError('WORKLET_NOT_SUPPORTED', 'AudioWorkletNode is not available');
  }

  const initialSelection = normalizeFeatureInput(options.features);
  const featureConfig = new Map<FeatureId, FeatureOptions<FeatureId> | true>();
  const featureSet = new Set<FeatureId>();
  for (const [feature, value] of Object.entries(initialSelection) as Array<
    [FeatureId, FeatureOptions<FeatureId> | true | undefined]
  >) {
    if (value !== undefined) {
      featureConfig.set(feature, value);
      featureSet.add(feature);
    }
  }

  const inputNode = context.createGain();
  const keepAliveGain = context.createGain();
  keepAliveGain.gain.value = 0;
  inputNode.connect(keepAliveGain);
  keepAliveGain.connect(context.destination);

  const workletNode = new AudioWorkletNode(context as AudioContext, 'audio-inspect-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: inputChannelCount,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
    processorOptions: {
      bufferSize,
      hopSize,
      inputChannelCount,
      features: cloneFeatureSelection(initialSelection as FeatureSelection<FeatureId>)
    }
  });

  let sessionState: MonitorState = 'idle';
  let closed = false;
  let pipelineConnected = false;

  const frameHandlers = new Set<(frame: MonitorFrame<SelectedFeatureIds<F>>) => void>();
  const errorHandlers = new Set<(event: MonitorErrorEvent) => void>();
  const latestResults: Partial<{ [K in SelectedFeatureIds<F>]: FeatureResult<K> }> = {};
  let latestFrame: MonitorFrame<SelectedFeatureIds<F>> | null = null;

  const internalSources = new Map<MonitorSource, InternalSourceRecord>();
  const mediaElementSourceNodes = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

  let emitTimer: ReturnType<typeof setTimeout> | null = null;
  let rafHandle: number | null = null;
  let opQueue = Promise.resolve();

  const emitNow = () => {
    if (!latestFrame || sessionState !== 'running') {
      return;
    }
    const frame = {
      timestamp: latestFrame.timestamp,
      results: cloneResults(latestFrame.results)
    } satisfies MonitorFrame<SelectedFeatureIds<F>>;
    for (const handler of frameHandlers) {
      handler(frame);
    }
  };

  const scheduleEmit = () => {
    if (emit === 'hop') {
      emitNow();
      return;
    }

    if (emit === 'raf') {
      if (rafHandle !== null) {
        return;
      }
      if (typeof requestAnimationFrame === 'function') {
        rafHandle = requestAnimationFrame(() => {
          rafHandle = null;
          emitNow();
        });
        return;
      }
      if (emitTimer === null) {
        emitTimer = setTimeout(() => {
          emitTimer = null;
          emitNow();
        }, 16);
      }
      return;
    }

    const hz = Math.max(1, emit);
    const delayMs = Math.max(1, Math.floor(1000 / hz));
    if (emitTimer !== null) {
      return;
    }
    emitTimer = setTimeout(() => {
      emitTimer = null;
      emitNow();
    }, delayMs);
  };

  const postFeatureSelection = () => {
    const nextSelection = Object.fromEntries(featureConfig) as FeatureSelection<FeatureId>;
    workletNode.port.postMessage({
      type: 'setFeatures',
      features: cloneFeatureSelection(nextSelection)
    });
  };

  const connectPipeline = () => {
    if (pipelineConnected || closed) {
      return;
    }
    inputNode.connect(workletNode);
    pipelineConnected = true;
  };

  const disconnectPipeline = () => {
    if (!pipelineConnected) {
      return;
    }
    try {
      inputNode.disconnect(workletNode);
    } catch {
      // ignore disconnect races
    }
    pipelineConnected = false;
  };

  const hasAttachedSources = () => internalSources.size > 0;

  const setState = (next: MonitorState) => {
    sessionState = next;
  };

  const ensureOpen = () => {
    if (closed) {
      throw new AudioInspectError('INVALID_STATE', 'Session is already closed');
    }
  };

  const publishError = (event: MonitorErrorEvent) => {
    for (const handler of errorHandlers) {
      handler(event);
    }
  };

  const handleWorkletMessage = (message: WorkletOutboundMessage) => {
    if (message.type === 'frame') {
      const frameMessage = message as WorkletFrameMessage;
      const resultRecord = frameMessage.results as Partial<Record<FeatureId, unknown>>;
      for (const [feature, value] of Object.entries(resultRecord) as Array<[FeatureId, unknown]>) {
        if (featureSet.has(feature)) {
          (latestResults as Partial<Record<FeatureId, unknown>>)[feature] = value;
        }
      }

      latestFrame = {
        timestamp: frameMessage.timestamp,
        results: latestResults
      };
      scheduleEmit();
      return;
    }

    const errorMessage = message as WorkletErrorMessage;
    const event: MonitorErrorEvent = {
      code: errorMessage.code,
      message: errorMessage.message,
      cause: errorMessage.details
    };
    if (errorMessage.recoverable !== undefined) {
      event.recoverable = errorMessage.recoverable;
    }
    publishError(event);
  };

  workletNode.port.onmessage = (event: MessageEvent) => {
    if (closed) {
      return;
    }
    handleWorkletMessage(event.data as WorkletOutboundMessage);
  };

  const syncPipeline = () => {
    if (sessionState === 'running') {
      connectPipeline();
    } else {
      disconnectPipeline();
    }
  };

  const resolveOutputTarget = (
    sourceInput: MonitorSource,
    output: MonitorOptions<F>['output']
  ): AudioNode | undefined => {
    if (typeof AudioNode !== 'undefined' && sourceInput instanceof AudioNode) {
      return undefined;
    }
    if (typeof AudioNode !== 'undefined' && output instanceof AudioNode) {
      return output;
    }
    if (output === 'destination') {
      return context.destination;
    }
    if (output === 'none') {
      return undefined;
    }
    if (isHtmlMediaElement(sourceInput)) {
      return context.destination;
    }
    return undefined;
  };

  const attach = (sourceInput: MonitorSource) => {
    ensureOpen();
    if (internalSources.has(sourceInput)) {
      return;
    }

    let sourceNode: AudioNode;
    if (sourceInput instanceof AudioNode) {
      sourceNode = sourceInput;
    } else if (isMediaStream(sourceInput)) {
      if (!hasMediaStreamSourceFactory(context)) {
        throw new AudioInspectError(
          'INVALID_INPUT',
          'This audio context cannot create MediaStream sources'
        );
      }
      sourceNode = context.createMediaStreamSource(sourceInput);
    } else if (isHtmlMediaElement(sourceInput)) {
      if (!hasMediaElementSourceFactory(context)) {
        throw new AudioInspectError(
          'INVALID_INPUT',
          'This audio context cannot create HTMLMediaElement sources'
        );
      }
      const existing = mediaElementSourceNodes.get(sourceInput);
      if (existing) {
        sourceNode = existing;
      } else {
        const created = context.createMediaElementSource(sourceInput);
        sourceNode = created;
        mediaElementSourceNodes.set(sourceInput, created);
      }
    } else {
      throw new AudioInspectError('INVALID_INPUT', 'Unsupported monitor source');
    }

    const outputNode = resolveOutputTarget(sourceInput, options.output);
    sourceNode.connect(inputNode);
    if (outputNode) {
      sourceNode.connect(outputNode);
    }

    internalSources.set(sourceInput, {
      source: sourceInput,
      sourceNode,
      outputNode
    });

    if (sessionState !== 'suspended') {
      setState('running');
      syncPipeline();
    }
  };

  const detachInternal = (sourceInput?: MonitorSource, skipOpenCheck = false) => {
    if (!skipOpenCheck) {
      ensureOpen();
    }

    const records = sourceInput
      ? [internalSources.get(sourceInput)].filter((value): value is InternalSourceRecord => !!value)
      : [...internalSources.values()];

    for (const record of records) {
      try {
        record.sourceNode.disconnect(inputNode);
      } catch {
        // ignore disconnect races
      }
      if (record.outputNode) {
        try {
          record.sourceNode.disconnect(record.outputNode);
        } catch {
          // ignore
        }
      }
      internalSources.delete(record.source);
    }

    if (!hasAttachedSources()) {
      setState('idle');
      syncPipeline();
    }
  };

  const enqueue = (operation: () => Promise<void> | void): Promise<void> => {
    opQueue = opQueue.then(async () => {
      ensureOpen();
      await operation();
    });
    return opQueue;
  };

  const session: MonitorSession<SelectedFeatureIds<F>> = {
    get state() {
      return sessionState;
    },

    get engine() {
      return 'worklet' as const;
    },

    get features() {
      return featureSet;
    },

    get node() {
      return inputNode;
    },

    setFeature(feature, optionsForFeature = true) {
      return enqueue(async () => {
        featureConfig.set(feature, optionsForFeature as FeatureOptions<FeatureId> | true);
        featureSet.add(feature);
        postFeatureSelection();
        await nextMicrotask();
      });
    },

    removeFeature(feature) {
      return enqueue(async () => {
        featureConfig.delete(feature);
        featureSet.delete(feature);
        delete (latestResults as Partial<Record<FeatureId, unknown>>)[feature];
        postFeatureSelection();
        await nextMicrotask();
      });
    },

    setFeatures(features) {
      return enqueue(async () => {
        const normalized = normalizeFeatureInput(features as FeatureInput<FeatureId>);
        featureConfig.clear();
        featureSet.clear();

        for (const [feature, value] of Object.entries(normalized) as Array<
          [FeatureId, FeatureOptions<FeatureId> | true | undefined]
        >) {
          if (value !== undefined) {
            featureConfig.set(feature, value);
            featureSet.add(feature);
          }
        }

        for (const existingFeature of Object.keys(latestResults) as FeatureId[]) {
          if (!featureSet.has(existingFeature)) {
            delete (latestResults as Partial<Record<FeatureId, unknown>>)[existingFeature];
          }
        }

        postFeatureSelection();
        await nextMicrotask();
      });
    },

    read() {
      if (!latestFrame) {
        return null;
      }
      return {
        timestamp: latestFrame.timestamp,
        results: cloneResults(latestFrame.results)
      };
    },

    readFeature(feature) {
      return (latestResults as Partial<Record<FeatureId, unknown>>)[feature] as
        | FeatureResult<typeof feature>
        | undefined;
    },

    onFrame(handler) {
      frameHandlers.add(handler);
      return () => {
        frameHandlers.delete(handler);
      };
    },

    onError(handler) {
      errorHandlers.add(handler);
      return () => {
        errorHandlers.delete(handler);
      };
    },

    attach,

    detach(sourceInput) {
      detachInternal(sourceInput, false);
    },

    suspend() {
      return enqueue(async () => {
        if (sessionState !== 'running') {
          return;
        }
        setState('suspended');
        syncPipeline();
      });
    },

    resume() {
      return enqueue(async () => {
        if (sessionState !== 'suspended') {
          return;
        }
        setState(hasAttachedSources() ? 'running' : 'idle');
        syncPipeline();
      });
    },

    close() {
      return enqueue(async () => {
        if (closed) {
          return;
        }

        detachInternal(undefined, true);
        closed = true;
        setState('closed');

        disconnectPipeline();

        if (emitTimer !== null) {
          clearTimeout(emitTimer);
          emitTimer = null;
        }
        if (rafHandle !== null && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(rafHandle);
          rafHandle = null;
        }

        try {
          inputNode.disconnect();
        } catch {
          // ignore
        }
        try {
          keepAliveGain.disconnect();
        } catch {
          // ignore
        }
        try {
          workletNode.port.close();
        } catch {
          // ignore
        }
        try {
          workletNode.disconnect();
        } catch {
          // ignore
        }

        frameHandlers.clear();
        errorHandlers.clear();
      });
    }
  };

  if (autoAttach && source) {
    attach(source);
  }

  if (!autoAttach) {
    setState('idle');
  }

  return session;
}
