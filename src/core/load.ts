import {
  type AudioData,
  type AudioDecoder,
  type AudioSource,
  AudioInspectError,
  type LoadOptions
} from '../types.js';

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new AudioInspectError('ABORTED', 'Operation aborted');
  }
}

function isAudioData(source: AudioSource): source is AudioData {
  return (
    typeof source === 'object' &&
    source !== null &&
    'sampleRate' in source &&
    'channelData' in source &&
    'duration' in source &&
    'numberOfChannels' in source &&
    'length' in source
  );
}

function isAudioBufferLike(source: AudioSource): source is AudioBuffer {
  return typeof AudioBuffer !== 'undefined' && source instanceof AudioBuffer;
}

function hasLoadTransforms(options: LoadOptions): boolean {
  return (
    options.sampleRate !== undefined || options.channels !== undefined || options.normalize === true
  );
}

function audioBufferToAudioData(buffer: AudioBuffer): AudioData {
  const channelData: Float32Array[] = [];
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    channelData.push(buffer.getChannelData(channel));
  }

  return {
    sampleRate: buffer.sampleRate,
    channelData,
    duration: buffer.duration,
    numberOfChannels: buffer.numberOfChannels,
    length: buffer.length
  };
}

function cloneAudioData(audio: AudioData): AudioData {
  return {
    sampleRate: audio.sampleRate,
    numberOfChannels: audio.numberOfChannels,
    duration: audio.duration,
    length: audio.length,
    channelData: audio.channelData.map((channel) => channel.slice())
  };
}

function toMono(audio: AudioData): AudioData {
  if (audio.numberOfChannels <= 1) {
    return audio;
  }

  const mono = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i++) {
    let sum = 0;
    for (let channel = 0; channel < audio.numberOfChannels; channel++) {
      sum += audio.channelData[channel]?.[i] ?? 0;
    }
    mono[i] = sum / audio.numberOfChannels;
  }

  return {
    sampleRate: audio.sampleRate,
    numberOfChannels: 1,
    length: audio.length,
    duration: audio.duration,
    channelData: [mono]
  };
}

function ensureStereo(audio: AudioData): AudioData {
  if (audio.numberOfChannels === 2) {
    return audio;
  }

  if (audio.numberOfChannels === 1) {
    const channel = audio.channelData[0] ?? new Float32Array(audio.length);
    return {
      sampleRate: audio.sampleRate,
      numberOfChannels: 2,
      length: audio.length,
      duration: audio.duration,
      channelData: [channel.slice(), channel.slice()]
    };
  }

  const left = audio.channelData[0] ?? new Float32Array(audio.length);
  const right = audio.channelData[1] ?? left;

  return {
    sampleRate: audio.sampleRate,
    numberOfChannels: 2,
    length: audio.length,
    duration: audio.duration,
    channelData: [left.slice(), right.slice()]
  };
}

function normalizePeak(audio: AudioData): AudioData {
  let maxAbs = 0;
  for (const channel of audio.channelData) {
    for (let i = 0; i < channel.length; i++) {
      const abs = Math.abs(channel[i] ?? 0);
      if (abs > maxAbs) {
        maxAbs = abs;
      }
    }
  }

  if (maxAbs <= 0 || maxAbs === 1) {
    return audio;
  }

  const scaledChannels = audio.channelData.map((channel) => {
    const out = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      out[i] = (channel[i] ?? 0) / maxAbs;
    }
    return out;
  });

  return {
    ...audio,
    channelData: scaledChannels
  };
}

function resampleLinear(audio: AudioData, targetSampleRate: number): AudioData {
  if (targetSampleRate <= 0 || !Number.isFinite(targetSampleRate)) {
    throw new AudioInspectError('INVALID_INPUT', 'sampleRate must be a positive finite number');
  }

  if (targetSampleRate === audio.sampleRate) {
    return audio;
  }

  const newLength = Math.max(1, Math.floor((audio.length * targetSampleRate) / audio.sampleRate));
  const ratio = audio.sampleRate / targetSampleRate;

  const newChannelData = audio.channelData.map((channel) => {
    const out = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const src = i * ratio;
      const left = Math.floor(src);
      const right = Math.min(left + 1, channel.length - 1);
      const frac = src - left;
      const leftValue = channel[left] ?? 0;
      const rightValue = channel[right] ?? leftValue;
      out[i] = leftValue + (rightValue - leftValue) * frac;
    }
    return out;
  });

  return {
    sampleRate: targetSampleRate,
    numberOfChannels: audio.numberOfChannels,
    length: newLength,
    duration: newLength / targetSampleRate,
    channelData: newChannelData
  };
}

function processAudioData(input: AudioData, options: LoadOptions): AudioData {
  let audio = input;

  if (options.channels === 'mono' || options.channels === 1) {
    audio = toMono(audio);
  } else if (options.channels === 'stereo' || options.channels === 2) {
    audio = ensureStereo(audio);
  }

  if (options.normalize) {
    audio = normalizePeak(audio);
  }

  if (options.sampleRate !== undefined && options.sampleRate !== audio.sampleRate) {
    audio = resampleLinear(audio, options.sampleRate);
  }

  return audio;
}

function isLikelyUrlString(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && !!process.versions?.node;
}

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getFetch(options: LoadOptions):
  | ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>)
  | undefined {
  if (options.fetch) {
    return options.fetch;
  }
  if (typeof fetch !== 'undefined') {
    return fetch.bind(globalThis);
  }
  return undefined;
}

async function decodeBytes(
  bytes: ArrayBuffer | ArrayBufferView | Blob,
  options: LoadOptions
): Promise<AudioData> {
  throwIfAborted(options.signal);

  const decoder: AudioDecoder | undefined = options.decoder;
  if (decoder) {
    const decodeOptions = options.signal ? { signal: options.signal } : undefined;
    return decoder.decode(bytes, decodeOptions);
  }

  if (isBrowserRuntime() && typeof AudioContext !== 'undefined') {
    const context = new AudioContext();
    try {
      const arrayBuffer =
        bytes instanceof ArrayBuffer
          ? bytes
          : bytes instanceof Blob
            ? await bytes.arrayBuffer()
            : (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      throwIfAborted(options.signal);
      const audioBuffer = await context.decodeAudioData(arrayBuffer);
      return audioBufferToAudioData(audioBuffer);
    } catch (error) {
      if (error instanceof AudioInspectError) {
        throw error;
      }
      throw new AudioInspectError(
        'DECODE_ERROR',
        `Audio decode failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    } finally {
      void context.close().catch(() => undefined);
    }
  }

  throw new AudioInspectError(
    'DECODE_BACKEND_MISSING',
    'No decode backend configured. Provide LoadOptions.decoder in this runtime.'
  );
}

async function loadArrayBufferSource(
  source: ArrayBuffer | ArrayBufferView,
  options: LoadOptions
): Promise<AudioData> {
  const bytes = source instanceof ArrayBuffer ? source : source;
  return decodeBytes(bytes, options);
}

async function loadUrlSource(source: URL | string, options: LoadOptions): Promise<AudioData> {
  const fetchImpl = getFetch(options);
  if (!fetchImpl) {
    throw new AudioInspectError('NETWORK_ERROR', 'Fetch is not available in this runtime');
  }

  const target = source instanceof URL ? source : source;
  const response = await fetchImpl(target);
  if (!response.ok) {
    throw new AudioInspectError('NETWORK_ERROR', `Failed to fetch audio source: ${response.status}`);
  }

  throwIfAborted(options.signal);
  const bytes = await response.arrayBuffer();
  return decodeBytes(bytes, options);
}

async function loadStringSource(source: string, options: LoadOptions): Promise<AudioData> {
  if (isNodeRuntime() && !isLikelyUrlString(source)) {
    const fs = await import('node:fs/promises');
    const fileBuffer = await fs.readFile(source);
    throwIfAborted(options.signal);
    return decodeBytes(fileBuffer, options);
  }

  return loadUrlSource(source, options);
}

async function loadSourceAsAudioData(source: AudioSource, options: LoadOptions): Promise<AudioData> {
  if (isAudioData(source)) {
    return source;
  }

  if (isAudioBufferLike(source)) {
    return audioBufferToAudioData(source);
  }

  if (typeof source === 'string') {
    return loadStringSource(source, options);
  }

  if (source instanceof URL) {
    return loadUrlSource(source, options);
  }

  if (source instanceof Blob) {
    return decodeBytes(source, options);
  }

  if (source instanceof ArrayBuffer) {
    return loadArrayBufferSource(source, options);
  }

  if (ArrayBuffer.isView(source)) {
    return loadArrayBufferSource(source, options);
  }

  throw new AudioInspectError('INVALID_INPUT', 'Unsupported audio source type');
}

export async function load(source: AudioSource, options: LoadOptions = {}): Promise<AudioData> {
  try {
    throwIfAborted(options.signal);

    if (isAudioData(source) && !hasLoadTransforms(options)) {
      return source;
    }

    const audio = await loadSourceAsAudioData(source, options);
    throwIfAborted(options.signal);

    if (!hasLoadTransforms(options)) {
      return audio;
    }

    const base = isAudioData(source) ? cloneAudioData(audio) : audio;
    return processAudioData(base, options);
  } catch (error) {
    if (error instanceof AudioInspectError) {
      throw error;
    }

    throw new AudioInspectError(
      'DECODE_ERROR',
      `Failed to load audio source: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}
