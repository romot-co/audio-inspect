
// Supported input aliases accepted by load/analyze APIs.
export type AudioLike = AudioData | AudioBuffer;

export type AudioSource =
  | AudioLike
  | ArrayBuffer
  | ArrayBufferView
  | Blob
  | File
  | URL
  | string;

// Canonical in-memory audio representation used across features.
export interface AudioData {
  sampleRate: number;
  channelData: Float32Array[];
  duration: number;
  numberOfChannels: number;
  length: number;
}

export type ChannelSelector = 'mix' | number | 'all' | readonly number[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Feature<T> = (audio: AudioData, ...args: any[]) => T | Promise<T>;

// Decoder abstraction for loading external audio sources.
export interface AudioDecoder {
  name: string;
  decode(
    input: ArrayBuffer | ArrayBufferView | Blob,
    options?: { signal?: AbortSignal }
  ): Promise<AudioData>;
}

// Shared options used by load().
export interface LoadOptions {
  sampleRate?: number;
  channels?: number | 'mono' | 'stereo';
  normalize?: boolean;
  signal?: AbortSignal;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  decoder?: AudioDecoder;
}

// Window names accepted by FFT/STFT-based features.
export type WindowFunction =
  | 'hann'
  | 'hamming'
  | 'blackman'
  | 'bartlett'
  | 'kaiser'
  | 'tukey'
  | 'rectangular'
  | 'none';

export interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a0: number;
  a1: number;
  a2: number;
}

// Common amplitude configuration across time/loudness features.
export interface AmplitudeOptions {
  channel?: ChannelSelector;
  asDB?: boolean;
  reference?: number;
  truePeak?: boolean;
  oversamplingFactor?: number;
  interpolation?: 'linear' | 'cubic' | 'sinc';
}

export interface CommonAnalysisOptions {
  channel?: ChannelSelector;
}

export interface TimeWindowOptions {
  windowSizeMs?: number;
  hopSizeMs?: number;
}

export interface FrequencyRangeOptions {
  minFrequency?: number;
  maxFrequency?: number;
}


export interface ProgressOptions {
  onProgress?: (percent: number, message?: string) => void;
}

// Base metadata shared by detailed analysis result payloads.
export interface BaseAnalysisResult {
  sampleRate: number;
  duration: number;
  processingTime?: number;
}

export interface WaveformAnalysisResult extends BaseAnalysisResult {
  amplitudes: Float32Array;
  timestamps?: Float32Array;
  frameCount: number;
  samplesPerFrame: number;
  framesPerSecond: number;
  maxAmplitude: number;
  averageAmplitude: number;
}

export interface PeaksAnalysisResult extends BaseAnalysisResult {
  positions: Float32Array;
  amplitudes: Float32Array;
  times: Float32Array;
  maxAmplitude: number;
  averageAmplitude: number;
  count: number;
}

export interface SpectrumAnalysisResult extends BaseAnalysisResult {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  phases?: Float32Array;
  fftSize: number;
  windowFunction: string;
}

export interface EnergyAnalysisResult extends BaseAnalysisResult {
  energies: Float32Array;
  times: Float32Array;
  totalEnergy: number;
  meanEnergy: number;
  maxEnergy: number;
  minEnergy: number;
}

export interface RMSAnalysisResult extends BaseAnalysisResult {
  value: number;
  valueDB?: number;
  channel: number;
}

export type NullableNumber = number | null;
export type NullableFloat32Array = Float32Array | null;

export type Result<T, E = AudioInspectError> =
  | { success: true; value: T }
  | { success: false; error: E };

// Canonical error codes used across public APIs.
export type ErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_STATE'
  | 'UNSUPPORTED_FORMAT'
  | 'DECODE_ERROR'
  | 'DECODE_BACKEND_MISSING'
  | 'NETWORK_ERROR'
  | 'PROCESSING_ERROR'
  | 'INITIALIZATION_FAILED'
  | 'WORKLET_NOT_SUPPORTED'
  | 'MODULE_LOAD_FAILED'
  | 'INSUFFICIENT_DATA'
  | 'MEMORY_ERROR'
  | 'ABORTED';

export class AudioInspectError extends Error {
  public override readonly name = 'AudioInspectError';
  public readonly code: ErrorCode;
  public override readonly cause?: unknown;
  public readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    cause?: unknown,
    details?: unknown
  ) {
    super(message, { cause });
    this.code = code;
    this.cause = cause;
    this.details = details;

    // Remove constructor frame for cleaner stack traces.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AudioInspectError);
    }
  }
}

export function createError(
  code: ErrorCode,
  message: string,
  details?: unknown
): AudioInspectError {
  return new AudioInspectError(code, message, undefined, details);
}

export function isAudioInspectError(error: unknown): error is AudioInspectError {
  return error instanceof AudioInspectError;
}
