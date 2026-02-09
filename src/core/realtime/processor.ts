declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare const registerProcessor: (name: string, processorCtor: unknown) => void;
declare const sampleRate: number;
declare const currentTime: number;

import type { AudioData } from '../../types.js';
import {
  executeFeature,
  normalizeFeatureInput,
  type FeatureExecutionRuntime,
  type FeatureId,
  type FeatureOptions,
  type FeatureResult,
  type FeatureSelection
} from '../feature-registry.js';
import { FFTProviderCacheStore } from '../dsp/fft-runtime.js';
import { RealtimeLUFSExecutor } from './lufs-executor.js';
import { WindowCacheStore } from '../dsp/window.js';
import { RealtimeFrameScheduler, type ScheduledFrame } from './frame-scheduler.js';
import type {
  WorkletErrorMessage,
  WorkletFrameMessage,
  WorkletInboundMessage,
  WorkletProcessorConfig
} from './messages.js';
import {
  isHeavyRealtimeFeature,
  normalizeHeavyFeatureInterval,
  normalizeRealtimePolicyMode
} from './policy.js';

interface PendingFrame {
  sampleIndex: number;
  timestamp: number;
  channelData: Float32Array[];
}

class AudioInspectProcessor extends AudioWorkletProcessor {
  private config: WorkletProcessorConfig;
  private scheduler: RealtimeFrameScheduler;
  private ringBuffers: Float32Array[] = [];
  private ringCapacity = 0;
  private readonly selectedFeatures = new Map<FeatureId, FeatureOptions<FeatureId> | true>();
  private readonly pendingFrames: PendingFrame[] = [];
  private isDrainingQueue = false;
  private processedFrameCount = 0;

  private readonly runtime: FeatureExecutionRuntime = {
    fftProviderCache: new FFTProviderCacheStore(),
    windowCache: new WindowCacheStore(),
    spectralCache: new Map<string, unknown>(),
    realtimeLUFS: new RealtimeLUFSExecutor()
  };

  constructor(options?: AudioWorkletNodeOptions) {
    super();

    const processorOptions = (options?.processorOptions ?? {}) as Partial<WorkletProcessorConfig>;
    const bufferSize = processorOptions.bufferSize ?? 1024;
    const hopSize = processorOptions.hopSize ?? 512;
    const inputChannelCount = processorOptions.inputChannelCount ?? 1;
    const realtimePolicy = normalizeRealtimePolicyMode(processorOptions.realtimePolicy);
    const heavyFeatureInterval = normalizeHeavyFeatureInterval(processorOptions.heavyFeatureInterval);

    this.config = {
      bufferSize,
      hopSize,
      inputChannelCount,
      features: processorOptions.features ?? {},
      realtimePolicy,
      heavyFeatureInterval
    };
    this.scheduler = new RealtimeFrameScheduler(bufferSize, hopSize);
    this.reinitializeRingBuffers();
    this.applyFeatureSelection(this.config.features);

    this.port.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data as WorkletInboundMessage);
    };
  }

  override process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    this.writeSilentOutput(outputs[0]);

    const input = inputs[0];
    const blockSize = input?.[0]?.length ?? 0;
    if (!input || blockSize === 0) {
      return true;
    }

    this.ensureRingCapacityForBlock(blockSize);
    this.writeInputBlock(input, blockSize);

    const frames = this.scheduler.append(blockSize);
    for (const frame of frames) {
      this.enqueueFrame(frame, blockSize);
    }

    void this.drainPendingFrames();
    return true;
  }

  private writeSilentOutput(output: Float32Array[] | undefined): void {
    if (!output) {
      return;
    }
    for (const channel of output) {
      if (channel) {
        channel.fill(0);
      }
    }
  }

  private handleMessage(message: WorkletInboundMessage): void {
    switch (message.type) {
      case 'setFeatures':
        this.applyFeatureSelection(message.features);
        break;
      case 'setConfig':
        this.updateConfig(message.config);
        break;
      case 'reset':
        this.reset();
        break;
    }
  }

  private applyFeatureSelection(selection: FeatureSelection<FeatureId>): void {
    this.selectedFeatures.clear();
    const normalized = normalizeFeatureInput(selection);
    this.config = {
      ...this.config,
      features: normalized as FeatureSelection<FeatureId>
    };
    const heavySelected: FeatureId[] = [];
    const strictDropped: FeatureId[] = [];

    for (const [feature, value] of Object.entries(normalized) as Array<
      [FeatureId, FeatureOptions<FeatureId> | true | false | null | undefined]
    >) {
      if (value === undefined || value === false || value === null) {
        continue;
      }
      const normalizedOptions = value === true ? undefined : value;
      const isHeavy = isHeavyRealtimeFeature(feature, normalizedOptions);
      if (isHeavy) {
        heavySelected.push(feature);
      }
      if (this.config.realtimePolicy === 'strict' && isHeavy) {
        strictDropped.push(feature);
        continue;
      }
      this.selectedFeatures.set(feature, value);
    }

    if (strictDropped.length > 0) {
      this.postPolicyWarning(
        `Strict realtime policy disabled heavy feature(s): ${strictDropped.join(', ')}`
      );
      return;
    }
    if (this.config.realtimePolicy === 'warn' && heavySelected.length > 0) {
      this.postPolicyWarning(
        `Heavy feature(s) are throttled to every ${this.config.heavyFeatureInterval} frame(s): ${heavySelected.join(
          ', '
        )}`
      );
    }
  }

  private updateConfig(config: Omit<WorkletProcessorConfig, 'features'>): void {
    const nextBufferSize = config.bufferSize;
    const nextHopSize = config.hopSize;
    const nextInputChannelCount = config.inputChannelCount;
    const nextRealtimePolicy = normalizeRealtimePolicyMode(config.realtimePolicy);
    const nextHeavyFeatureInterval = normalizeHeavyFeatureInterval(config.heavyFeatureInterval);

    if (
      nextBufferSize === this.config.bufferSize &&
      nextHopSize === this.config.hopSize &&
      nextInputChannelCount === this.config.inputChannelCount &&
      nextRealtimePolicy === this.config.realtimePolicy &&
      nextHeavyFeatureInterval === this.config.heavyFeatureInterval
    ) {
      return;
    }

    this.config = {
      ...this.config,
      bufferSize: nextBufferSize,
      hopSize: nextHopSize,
      inputChannelCount: nextInputChannelCount,
      realtimePolicy: nextRealtimePolicy,
      heavyFeatureInterval: nextHeavyFeatureInterval
    };
    this.scheduler = new RealtimeFrameScheduler(this.config.bufferSize, this.config.hopSize);
    this.reinitializeRingBuffers();
    this.resetRuntimeState();
    this.applyFeatureSelection(this.config.features);
  }

  private reset(): void {
    this.scheduler.reset();
    this.pendingFrames.length = 0;
    this.processedFrameCount = 0;
    for (const buffer of this.ringBuffers) {
      buffer.fill(0);
    }
    this.resetRuntimeState();
  }

  private resetRuntimeState(): void {
    this.runtime.realtimeLUFS?.reset();
    this.runtime.fftProviderCache?.clear();
    this.runtime.windowCache?.clear();
    this.runtime.spectralCache?.clear();
  }

  private reinitializeRingBuffers(): void {
    this.ringCapacity = Math.max(4096, this.config.bufferSize * 4);
    this.ringBuffers = new Array(this.config.inputChannelCount)
      .fill(null)
      .map(() => new Float32Array(this.ringCapacity));
    this.pendingFrames.length = 0;
  }

  private ensureRingCapacityForBlock(blockSize: number): void {
    const unreadSamples = this.scheduler.writeIndex - this.scheduler.nextFrameStart;
    const requiredCapacity = unreadSamples + blockSize + 1;
    if (requiredCapacity <= this.ringCapacity) {
      return;
    }

    let nextCapacity = this.ringCapacity;
    while (nextCapacity < requiredCapacity) {
      nextCapacity *= 2;
    }

    const nextBuffers = new Array(this.config.inputChannelCount)
      .fill(null)
      .map(() => new Float32Array(nextCapacity));

    const copyStart = Math.max(0, this.scheduler.writeIndex - unreadSamples);
    const copyEnd = this.scheduler.writeIndex;
    for (let channel = 0; channel < this.config.inputChannelCount; channel++) {
      const source = this.ringBuffers[channel];
      const target = nextBuffers[channel];
      if (!source || !target) {
        continue;
      }

      for (let absoluteIndex = copyStart; absoluteIndex < copyEnd; absoluteIndex++) {
        target[absoluteIndex % nextCapacity] = source[absoluteIndex % this.ringCapacity]!;
      }
    }

    this.ringBuffers = nextBuffers;
    this.ringCapacity = nextCapacity;
  }

  private writeInputBlock(input: Float32Array[], blockSize: number): void {
    const sourceChannelCount = input.length;
    const writeStart = this.scheduler.writeIndex;
    for (let channel = 0; channel < this.config.inputChannelCount; channel++) {
      const source = input[Math.min(channel, sourceChannelCount - 1)] ?? input[0];
      const target = this.ringBuffers[channel];
      if (!target) {
        continue;
      }

      for (let i = 0; i < blockSize; i++) {
        target[(writeStart + i) % this.ringCapacity] = source?.[i] ?? 0;
      }
    }
  }

  private enqueueFrame(frame: ScheduledFrame, blockSize: number): void {
    const frameLength = frame.end - frame.start;
    const channelData: Float32Array[] = [];

    for (let channel = 0; channel < this.config.inputChannelCount; channel++) {
      const output = new Float32Array(frameLength);
      const source = this.ringBuffers[channel];
      if (source) {
        for (let i = 0; i < frameLength; i++) {
          output[i] = source[(frame.start + i) % this.ringCapacity]!;
        }
      }
      channelData.push(output);
    }

    const lagSamples = this.scheduler.writeIndex - frame.end;
    const blockEndTime = currentTime + blockSize / sampleRate;
    const timestamp = blockEndTime - lagSamples / sampleRate;

    this.pendingFrames.push({
      sampleIndex: frame.start,
      timestamp,
      channelData
    });
  }

  private async drainPendingFrames(): Promise<void> {
    if (this.isDrainingQueue) {
      return;
    }

    this.isDrainingQueue = true;
    try {
      while (this.pendingFrames.length > 0) {
        const frame = this.pendingFrames.shift();
        if (!frame) {
          break;
        }
        await this.processFrame(frame);
      }
    } finally {
      this.isDrainingQueue = false;
    }
  }

  private async processFrame(frame: PendingFrame): Promise<void> {
    if (this.selectedFeatures.size === 0) {
      return;
    }
    const frameOrdinal = this.processedFrameCount++;

    const audioData: AudioData = {
      sampleRate,
      channelData: frame.channelData,
      numberOfChannels: frame.channelData.length,
      length: this.config.bufferSize,
      duration: this.config.bufferSize / sampleRate
    };
    const results: Partial<{ [K in FeatureId]: FeatureResult<K> }> = {};

    for (const [feature, rawOptions] of this.selectedFeatures.entries()) {
      if (!this.shouldExecuteFeature(feature, rawOptions, frameOrdinal)) {
        continue;
      }
      const options = rawOptions === true ? undefined : rawOptions;
      try {
        const result = await executeFeature(
          feature,
          audioData,
          options as FeatureOptions<typeof feature> | undefined,
          this.runtime
        );
        (results as Partial<Record<FeatureId, unknown>>)[feature] = result;
      } catch (error) {
        this.postError({
          type: 'error',
          code: 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : `Feature ${feature} failed`,
          details: error,
          recoverable: true
        });
      }
    }

    const message: WorkletFrameMessage = {
      type: 'frame',
      timestamp: frame.timestamp,
      sampleIndex: frame.sampleIndex,
      results
    };
    this.port.postMessage(message);
  }

  private postError(error: WorkletErrorMessage): void {
    this.port.postMessage(error);
  }

  private postPolicyWarning(message: string): void {
    this.postError({
      type: 'error',
      code: 'REALTIME_POLICY_WARNING',
      message,
      recoverable: true
    });
  }

  private shouldExecuteFeature(
    feature: FeatureId,
    rawOptions: FeatureOptions<FeatureId> | true,
    frameOrdinal: number
  ): boolean {
    const options = rawOptions === true ? undefined : rawOptions;
    if (!isHeavyRealtimeFeature(feature, options)) {
      return true;
    }
    if (this.config.realtimePolicy === 'allow') {
      return true;
    }
    if (this.config.realtimePolicy === 'strict') {
      return false;
    }
    return frameOrdinal % this.config.heavyFeatureInterval === 0;
  }
}

registerProcessor('audio-inspect-processor', AudioInspectProcessor);
