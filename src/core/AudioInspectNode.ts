import {
  AudioInspectNodeOptions,
  AudioInspectNodeEventHandlers,
  AudioInspectProcessorOptions,
  AnalysisResultMessage,
  ErrorMessage,
  UpdateOptionsMessage,
  AudioInspectError
} from '../types.js';
import type { FFTProviderType } from './fft-provider.js';

// Check if AudioWorkletNode is available (browser environment only)
const isAudioWorkletSupported = typeof AudioWorkletNode !== 'undefined';

// Mock port interface for type safety
interface MockPort {
  postMessage: (message: unknown) => void;
  close: () => void;
  onmessage: ((event: MessageEvent) => void) | null;
}

// Mock AudioWorkletNode for Node.js environment
class MockAudioWorkletNode {
  numberOfInputs = 1;
  numberOfOutputs = 0;
  channelCount = 2;
  channelCountMode: ChannelCountMode = 'max';
  channelInterpretation: ChannelInterpretation = 'speakers';
  context: BaseAudioContext | null = null;

  port: MockPort = {
    postMessage: () => {},
    close: () => {},
    onmessage: null as ((event: MessageEvent) => void) | null
  };

  constructor() {}

  connect(): this {
    return this;
  }
  disconnect(): this {
    return this;
  }
  dispatchEvent(): boolean {
    return true;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
}

/**
 * Custom AudioNode: Provides real-time audio analysis
 * Extends AudioWorkletNode to function as a standard AudioNode
 */
export class AudioInspectNode
  extends (isAudioWorkletSupported ? AudioWorkletNode : MockAudioWorkletNode)
  implements AudioInspectNodeEventHandlers
{
  public onresult?: (event: { data: unknown; timestamp: number }) => void;
  public onerror?: (event: { message: string; detail?: unknown }) => void;

  // Cache current settings (last values sent to processor)
  private _featureName: string = 'getRMS';
  private _featureOptions?: unknown;
  private _bufferSize: number = 1024;
  private _hopSize: number = 512;
  private _provider?: FFTProviderType; // FFT provider

  constructor(context?: BaseAudioContext, nodeOptions?: AudioInspectNodeOptions) {
    if (!isAudioWorkletSupported) {
      // In Node.js environment, call mock constructor
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      super();
      this._initializeMockMode(nodeOptions);
      return;
    }

    if (!context) {
      throw new AudioInspectError(
        'INITIALIZATION_FAILED',
        'AudioContext is required in browser environment'
      );
    }

    // Set default options
    const options = {
      featureName: 'getRMS',
      bufferSize: 1024,
      hopSize: 512,
      inputChannelCount: 1,
      provider: 'native' as FFTProviderType,
      ...nodeOptions
    };

    // Create processor options
    const processorOptions: AudioInspectProcessorOptions = {
      featureName: options.featureName,
      featureOptions: options.featureOptions,
      bufferSize: options.bufferSize,
      hopSize: options.hopSize,
      inputChannelCount: options.inputChannelCount,
      provider: options.provider
    };

    // Call parent class (AudioWorkletNode) constructor
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super(context, 'audio-inspect-processor', {
      processorOptions,
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: options.inputChannelCount,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers'
    });

    // Cache settings
    this._featureName = options.featureName;
    this._featureOptions = options.featureOptions;
    this._bufferSize = options.bufferSize;
    this._hopSize = options.hopSize;
    this._provider = options.provider;

    // Set up message handler - port should be available from AudioWorkletNode
    this.setupMessageHandler();
  }

  private _initializeMockMode(nodeOptions?: AudioInspectNodeOptions): void {
    // Initialize mock mode for Node.js testing
    const options = {
      featureName: 'getRMS',
      bufferSize: 1024,
      hopSize: 512,
      provider: 'native' as FFTProviderType,
      ...nodeOptions
    };

    this._featureName = options.featureName;
    this._featureOptions = options.featureOptions;
    this._bufferSize = options.bufferSize;
    this._hopSize = options.hopSize;
    this._provider = options.provider;
  }

  private getPort(): MessagePort | MockPort {
    return (this as unknown as { port: MessagePort | MockPort }).port;
  }

  private setupMessageHandler(): void {
    const port = this.getPort();
    if (port) {
      port.onmessage = this.handleMessage.bind(this);
    }
  }

  /**
   * Get current analysis feature name (last set value)
   */
  get featureName(): string {
    return this._featureName;
  }

  /**
   * Get current analysis options (last set value)
   */
  get featureOptions(): unknown {
    return this._featureOptions;
  }

  /**
   * Get current buffer size (last set value)
   */
  get bufferSize(): number {
    return this._bufferSize;
  }

  /**
   * Get current hop size (last set value)
   */
  get hopSize(): number {
    return this._hopSize;
  }

  /**
   * Get current FFT provider (last set value)
   */
  get provider(): FFTProviderType | undefined {
    return this._provider;
  }

  /**
   * Update analysis options (supports partial updates)
   */
  updateOptions(options: Partial<AudioInspectNodeOptions>): void {
    const payload: Partial<AudioInspectProcessorOptions> = {};

    // Include only changed options in payload
    if (options.featureName !== undefined && options.featureName !== this._featureName) {
      this._featureName = options.featureName;
      payload.featureName = options.featureName;
    }
    if (options.featureOptions !== undefined) {
      this._featureOptions = options.featureOptions;
      payload.featureOptions = options.featureOptions;
    }
    if (options.bufferSize !== undefined && options.bufferSize !== this._bufferSize) {
      this._bufferSize = options.bufferSize;
      payload.bufferSize = options.bufferSize;
    }
    if (options.hopSize !== undefined && options.hopSize !== this._hopSize) {
      this._hopSize = options.hopSize;
      payload.hopSize = options.hopSize;
    }
    if (options.inputChannelCount !== undefined) {
      payload.inputChannelCount = options.inputChannelCount;
    }
    if (options.provider !== undefined && options.provider !== this._provider) {
      this._provider = options.provider;
      payload.provider = options.provider;
    }

    // Send to processor only if there are changes
    if (Object.keys(payload).length > 0) {
      const message: UpdateOptionsMessage = {
        type: 'updateOptions',
        payload
      };

      const port = this.getPort();
      if (port && 'postMessage' in port) {
        port.postMessage(message);
      }
    }
  }

  /**
   * Reset internal state
   */
  reset(): void {
    const port = this.getPort();
    if (port && 'postMessage' in port) {
      port.postMessage({ type: 'reset' });
    }
  }

  /**
   * Release resources
   */
  dispose(): void {
    (this as unknown as AudioNode).disconnect();
    const port = this.getPort();
    if (port && 'close' in port) {
      port.close();
    }
  }

  /**
   * Handle messages from processor
   */
  private handleMessage(event: MessageEvent): void {
    const message = event.data as { type: string };

    switch (message.type) {
      case 'analysisResult':
        this.handleAnalysisResult(message as AnalysisResultMessage);
        break;
      case 'error':
        this.handleError(message as ErrorMessage);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Handle analysis results
   */
  private handleAnalysisResult(message: AnalysisResultMessage): void {
    const event = {
      data: message.data,
      timestamp: message.timestamp
    };

    // Execute onresult handler if available
    if (this.onresult) {
      this.onresult(event);
    }

    // Also fire as custom event
    if ('dispatchEvent' in this) {
      (this as unknown as EventTarget).dispatchEvent(new CustomEvent('result', { detail: event }));
    }
  }

  /**
   * Handle errors
   */
  private handleError(message: ErrorMessage): void {
    const event = {
      message: message.message,
      detail: message.detail
    };

    // Execute onerror handler if available
    if (this.onerror) {
      this.onerror(event);
    }

    // Also fire as custom event
    if ('dispatchEvent' in this) {
      (this as unknown as EventTarget).dispatchEvent(new CustomEvent('error', { detail: event }));
    }
  }
}
