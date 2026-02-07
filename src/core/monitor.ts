import { AudioInspectNode } from './AudioInspectNode.js';
import {
  getFeatureFunctionName,
  normalizeFeatureInput,
  type FeatureId,
  type FeatureInput,
  type FeatureOptions,
  type FeatureResult,
  type FeatureSelection,
  type SelectedFeatureIds,
  executeFeature
} from './feature-registry.js';
import { prepareWorklet, type PrepareWorkletOptions } from './realtime-worklet.js';
import { AudioInspectError, type AudioInspectNodeOptions } from '../types.js';

export type MonitorEngine = 'worklet' | 'main-thread';
export type MonitorEngineMode = 'auto' | MonitorEngine;

export type MonitorSource = AudioNode | MediaStream | HTMLMediaElement;

export type MonitorState = 'idle' | 'running' | 'suspended' | 'closed';

export interface MonitorOptions<F extends FeatureInput = FeatureInput> {
  context: BaseAudioContext;
  features: F;

  source?: MonitorSource;
  autoAttach?: boolean;

  engine?: MonitorEngineMode;
  fallback?: 'main-thread' | 'error';

  worklet?: PrepareWorkletOptions;

  bufferSize?: number;
  hopSize?: number;
  inputChannelCount?: number;

  // Applies only to internally-created source nodes (MediaStream/HTMLMediaElement).
  output?: 'none' | 'destination' | AudioNode;

  emit?: 'hop' | 'raf' | number;
}

export interface MonitorFrame<T extends FeatureId = FeatureId> {
  /**
   * Timestamp in seconds, aligned to BaseAudioContext.currentTime semantics.
   * When coalescing, this is the last completed frame time.
   */
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

function nextMicrotask(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

function cloneResults<T extends FeatureId>(
  results: Partial<{ [K in T]: FeatureResult<K> }>
): Partial<{ [K in T]: FeatureResult<K> }> {
  return { ...results };
}

export async function monitor<const F extends FeatureInput>(
  options: MonitorOptions<F>
): Promise<MonitorSession<SelectedFeatureIds<F>>> {
  const {
    context,
    source,
    autoAttach = source !== undefined,
    engine = 'auto',
    fallback = 'main-thread',
    bufferSize = 1024,
    hopSize = 512,
    inputChannelCount = 1,
    emit = 'hop'
  } = options;

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

  let selectedEngine: MonitorEngine;
  if (engine === 'main-thread') {
    selectedEngine = 'main-thread';
  } else if (engine === 'worklet') {
    selectedEngine = 'worklet';
  } else {
    selectedEngine = 'worklet';
  }

  if (selectedEngine === 'worklet') {
    try {
      await prepareWorklet(context, options.worklet);
    } catch (error) {
      if (engine === 'worklet' || fallback === 'error') {
        throw error;
      }
      selectedEngine = 'main-thread';
    }
  }

  let sessionState: MonitorState = 'idle';
  let closed = false;

  const frameHandlers = new Set<(frame: MonitorFrame<SelectedFeatureIds<F>>) => void>();
  const errorHandlers = new Set<(event: MonitorErrorEvent) => void>();

  const internalSources = new Map<MonitorSource, InternalSourceRecord>();
  const mediaElementSourceNodes = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

  const latestResults: Partial<{ [K in SelectedFeatureIds<F>]: FeatureResult<K> }> = {};
  let latestFrame: MonitorFrame<SelectedFeatureIds<F>> | null = null;

  let emitTimer: ReturnType<typeof setTimeout> | null = null;
  let rafHandle: number | null = null;

  let workletConnected = false;
  const featureNodes = new Map<FeatureId, AudioInspectNode>();

  let scriptProcessor: ScriptProcessorNode | null = null;
  const ringBuffers: Float32Array[] = [];
  let ringWritePosition = 0;
  let lastAnalysisPosition = 0;
  let processing = false;
  let pendingFrameData: Float32Array[] | null = null;

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

  const setState = (next: MonitorState) => {
    sessionState = next;
  };

  const hasAttachedSources = () => internalSources.size > 0;

  const ensureOpen = () => {
    if (closed) {
      throw new AudioInspectError('INVALID_STATE', 'Session is already closed');
    }
  };

  const publishFeatureResult = <K extends FeatureId>(feature: K, value: FeatureResult<K>) => {
    (latestResults as Partial<Record<FeatureId, unknown>>)[feature] = value;
    latestFrame = {
      timestamp: context.currentTime,
      results: latestResults
    };

    scheduleEmit();
  };

  const publishError = (error: MonitorErrorEvent) => {
    for (const handler of errorHandlers) {
      handler(error);
    }
  };

  const connectWorkletNodes = () => {
    if (workletConnected) {
      return;
    }

    for (const node of featureNodes.values()) {
      inputNode.connect(node as unknown as AudioNode);
    }
    workletConnected = true;
  };

  const disconnectWorkletNodes = () => {
    if (!workletConnected) {
      return;
    }

    for (const node of featureNodes.values()) {
      try {
        inputNode.disconnect(node as unknown as AudioNode);
      } catch {
        // ignore disconnect races
      }
    }

    workletConnected = false;
  };

  const setupScriptProcessor = () => {
    if (scriptProcessor) {
      return;
    }

    const processor = context.createScriptProcessor(bufferSize, inputChannelCount, 1);
    scriptProcessor = processor;

    const capacity = bufferSize * 4;
    for (let channel = 0; channel < inputChannelCount; channel++) {
      ringBuffers[channel] = new Float32Array(capacity);
    }

    const processPending = async () => {
      if (!pendingFrameData || processing || closed || sessionState !== 'running') {
        return;
      }

      processing = true;
      const frameData = pendingFrameData;
      pendingFrameData = null;

      try {
        const audioFrame = {
          sampleRate: context.sampleRate,
          channelData: frameData,
          numberOfChannels: frameData.length,
          length: frameData[0]?.length ?? 0,
          duration: (frameData[0]?.length ?? 0) / context.sampleRate
        };

        for (const [feature, rawOptions] of featureConfig.entries()) {
          const optionsForFeature = rawOptions === true ? undefined : rawOptions;
          try {
            const result = await executeFeature(feature, audioFrame, optionsForFeature as never);
            publishFeatureResult(feature, result as FeatureResult<FeatureId>);
          } catch (error) {
            publishError({
              code: error instanceof AudioInspectError ? error.code : 'PROCESSING_ERROR',
              message:
                error instanceof Error ? error.message : `Failed to process feature ${feature}`,
              cause: error,
              recoverable: true
            });
          }
        }
      } finally {
        processing = false;
        if (pendingFrameData) {
          void processPending();
        }
      }
    };

    processor.onaudioprocess = (event) => {
      if (closed || sessionState !== 'running') {
        return;
      }

      const inputBuffer = event.inputBuffer;
      const frameSize = inputBuffer.length;

      if (ringWritePosition + frameSize > capacity) {
        const shiftAmount = Math.max(0, ringWritePosition - bufferSize);
        for (const buffer of ringBuffers) {
          buffer.copyWithin(0, shiftAmount, ringWritePosition);
        }
        ringWritePosition = bufferSize;
        lastAnalysisPosition = Math.max(0, lastAnalysisPosition - shiftAmount);
      }

      for (let channel = 0; channel < inputChannelCount; channel++) {
        const channelData = inputBuffer.getChannelData(
          Math.min(channel, inputBuffer.numberOfChannels - 1)
        );
        const target = ringBuffers[channel] ?? (ringBuffers[channel] = new Float32Array(capacity));
        for (let i = 0; i < frameSize; i++) {
          target[ringWritePosition + i] = channelData[i] ?? 0;
        }
      }

      ringWritePosition += frameSize;

      const newData = ringWritePosition - lastAnalysisPosition;
      if (newData < hopSize || ringWritePosition < bufferSize) {
        return;
      }

      lastAnalysisPosition += hopSize;
      const start = ringWritePosition - bufferSize;
      const frameData: Float32Array[] = [];
      for (let channel = 0; channel < inputChannelCount; channel++) {
        const target = ringBuffers[channel] ?? (ringBuffers[channel] = new Float32Array(capacity));
        frameData[channel] = target.slice(start, start + bufferSize);
      }

      pendingFrameData = frameData;
      void processPending();
    };

    inputNode.connect(processor);
    processor.connect(keepAliveGain);
  };

  const teardownScriptProcessor = () => {
    if (!scriptProcessor) {
      return;
    }

    try {
      inputNode.disconnect(scriptProcessor);
    } catch {
      // ignore
    }

    try {
      scriptProcessor.disconnect();
    } catch {
      // ignore
    }

    scriptProcessor.onaudioprocess = null;
    scriptProcessor = null;
    ringWritePosition = 0;
    lastAnalysisPosition = 0;
    pendingFrameData = null;
    processing = false;
  };

  const syncEnginePipeline = () => {
    if (selectedEngine === 'worklet') {
      if (sessionState === 'running') {
        connectWorkletNodes();
      } else {
        disconnectWorkletNodes();
      }
      return;
    }

    if (sessionState === 'running') {
      setupScriptProcessor();
      return;
    }

    teardownScriptProcessor();
  };

  const applyWorkletFeatureSet = async () => {
    if (selectedEngine !== 'worklet') {
      return;
    }

    const active = new Set(featureConfig.keys());
    for (const [feature, node] of featureNodes.entries()) {
      if (!active.has(feature)) {
        try {
          inputNode.disconnect(node as unknown as AudioNode);
        } catch {
          // ignore
        }
        node.dispose();
        featureNodes.delete(feature);
      }
    }

    for (const [feature, rawOptions] of featureConfig.entries()) {
      const optionsForFeature = rawOptions === true ? undefined : rawOptions;
      const existing = featureNodes.get(feature);

      if (existing) {
        existing.updateOptions({ featureOptions: optionsForFeature ?? {} });
        continue;
      }

      const nodeOptions: AudioInspectNodeOptions = {
        featureName: getFeatureFunctionName(feature),
        bufferSize,
        hopSize,
        inputChannelCount
      };
      if (optionsForFeature !== undefined) {
        nodeOptions.featureOptions = optionsForFeature;
      }
      const node = new AudioInspectNode(context, nodeOptions);

      node.onresult = (event) => {
        if (closed || sessionState !== 'running') {
          return;
        }
        publishFeatureResult(feature, event.data as FeatureResult<FeatureId>);
      };
      node.onerror = (event) => {
        publishError({
          code: 'PROCESSING_ERROR',
          message: event.message,
          cause: event.detail,
          recoverable: true
        });
      };

      featureNodes.set(feature, node);

      if (sessionState === 'running') {
        inputNode.connect(node as unknown as AudioNode);
      }
    }

    workletConnected = sessionState === 'running';
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

    const outputTarget = resolveOutputTarget(sourceInput, options.output);

    sourceNode.connect(inputNode);

    if (outputTarget) {
      sourceNode.connect(outputTarget);
    }

    internalSources.set(sourceInput, {
      source: sourceInput,
      sourceNode,
      outputNode: outputTarget
    });

    if (sessionState !== 'suspended') {
      setState('running');
      syncEnginePipeline();
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
        // ignore
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
      syncEnginePipeline();
    }
  };

  const detach = (sourceInput?: MonitorSource) => {
    detachInternal(sourceInput, false);
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
      return selectedEngine;
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
        await applyWorkletFeatureSet();
        await nextMicrotask();
      });
    },

    removeFeature(feature) {
      return enqueue(async () => {
        featureConfig.delete(feature);
        featureSet.delete(feature);
        delete (latestResults as Partial<Record<FeatureId, unknown>>)[feature];
        await applyWorkletFeatureSet();
        await nextMicrotask();
      });
    },

    setFeatures(features) {
      return enqueue(async () => {
        const nextSelection = features as FeatureSelection<FeatureId>;

        featureConfig.clear();
        featureSet.clear();

        for (const [feature, value] of Object.entries(nextSelection) as Array<
          [FeatureId, FeatureOptions<FeatureId> | true | undefined]
        >) {
          if (value !== undefined) {
            featureConfig.set(feature, value);
            featureSet.add(feature);
          }
        }

        for (const key of Object.keys(latestResults) as FeatureId[]) {
          if (!featureSet.has(key)) {
            delete (latestResults as Partial<Record<FeatureId, unknown>>)[key];
          }
        }

        await applyWorkletFeatureSet();
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
    detach,

    suspend() {
      return enqueue(async () => {
        if (sessionState !== 'running') {
          return;
        }

        setState('suspended');
        syncEnginePipeline();
      });
    },

    resume() {
      return enqueue(async () => {
        if (sessionState !== 'suspended') {
          return;
        }

        setState(hasAttachedSources() ? 'running' : 'idle');
        syncEnginePipeline();
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

        disconnectWorkletNodes();
        for (const node of featureNodes.values()) {
          node.dispose();
        }
        featureNodes.clear();

        teardownScriptProcessor();

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

        frameHandlers.clear();
        errorHandlers.clear();
      });
    }
  };

  if (selectedEngine === 'worklet') {
    await applyWorkletFeatureSet();
  }

  if (autoAttach && source) {
    attach(source);
  }

  return session;
}
