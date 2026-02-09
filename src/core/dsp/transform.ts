import { AudioInspectError, type AudioData } from '../../types.js';

export function toMono(audio: AudioData): AudioData {
  if (audio.numberOfChannels <= 1) {
    return audio;
  }

  const mono = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i++) {
    let sum = 0;
    for (let ch = 0; ch < audio.numberOfChannels; ch++) {
      const channel = audio.channelData[ch];
      if (channel) {
        sum += channel[i] ?? 0;
      }
    }
    mono[i] = sum / audio.numberOfChannels;
  }

  return {
    sampleRate: audio.sampleRate,
    channelData: [mono],
    numberOfChannels: 1,
    length: audio.length,
    duration: audio.duration
  };
}

export function ensureStereo(audio: AudioData): AudioData {
  if (audio.numberOfChannels === 2) {
    return audio;
  }
  if (audio.numberOfChannels === 1) {
    const mono = audio.channelData[0] ?? new Float32Array(audio.length);
    return {
      sampleRate: audio.sampleRate,
      numberOfChannels: 2,
      channelData: [mono.slice(), mono.slice()],
      length: audio.length,
      duration: audio.duration
    };
  }

  const left = audio.channelData[0] ?? new Float32Array(audio.length);
  const right = audio.channelData[1] ?? left;
  return {
    sampleRate: audio.sampleRate,
    numberOfChannels: 2,
    channelData: [left.slice(), right.slice()],
    length: audio.length,
    duration: audio.duration
  };
}

export function normalizePeak(audio: AudioData): AudioData {
  let maxAbs = 0;
  for (const channel of audio.channelData) {
    for (let i = 0; i < channel.length; i++) {
      maxAbs = Math.max(maxAbs, Math.abs(channel[i]!));
    }
  }

  if (maxAbs <= 0 || maxAbs === 1) {
    return audio;
  }

  const scaled = audio.channelData.map((channel) => {
    const out = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      out[i] = channel[i]! / maxAbs;
    }
    return out;
  });

  return {
    ...audio,
    channelData: scaled
  };
}

export function sliceAudio(audio: AudioData, startTime: number, endTime: number): AudioData {
  if (startTime < 0 || endTime < 0 || startTime >= endTime) {
    throw new AudioInspectError('INVALID_INPUT', 'Invalid time range', { startTime, endTime });
  }
  if (endTime > audio.duration) {
    throw new AudioInspectError('INVALID_INPUT', 'End time exceeds audio duration', {
      endTime,
      duration: audio.duration
    });
  }

  const startSample = Math.floor(startTime * audio.sampleRate);
  const endSample = Math.min(Math.floor(endTime * audio.sampleRate), audio.length);
  const length = endSample - startSample;
  if (length <= 0) {
    throw new AudioInspectError('INSUFFICIENT_DATA', 'Slice range produced no samples');
  }

  return {
    sampleRate: audio.sampleRate,
    numberOfChannels: audio.numberOfChannels,
    channelData: audio.channelData.map((channel) => channel.slice(startSample, endSample)),
    length,
    duration: length / audio.sampleRate
  };
}

export function resampleLinear(audio: AudioData, targetSampleRate: number): AudioData {
  if (!Number.isFinite(targetSampleRate) || targetSampleRate <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'sampleRate must be positive');
  }

  if (targetSampleRate === audio.sampleRate) {
    return audio;
  }

  const newLength = Math.max(1, Math.floor((audio.length * targetSampleRate) / audio.sampleRate));
  const ratio = audio.sampleRate / targetSampleRate;
  const channelData = audio.channelData.map((channel) => {
    const out = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const src = i * ratio;
      const left = Math.floor(src);
      const right = Math.min(left + 1, channel.length - 1);
      const frac = src - left;
      out[i] = channel[left]! + (channel[right]! - channel[left]!) * frac;
    }
    return out;
  });

  return {
    sampleRate: targetSampleRate,
    numberOfChannels: audio.numberOfChannels,
    channelData,
    length: newLength,
    duration: newLength / targetSampleRate
  };
}

export async function resampleWithOfflineAudioContext(
  audio: AudioData,
  targetSampleRate: number,
  signal?: AbortSignal
): Promise<AudioData> {
  if (!Number.isFinite(targetSampleRate) || targetSampleRate <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'sampleRate must be positive');
  }

  if (targetSampleRate === audio.sampleRate) {
    return audio;
  }

  if (signal?.aborted) {
    throw new AudioInspectError('ABORTED', 'Operation aborted');
  }

  if (audio.numberOfChannels === 0 || audio.length === 0) {
    return {
      sampleRate: targetSampleRate,
      numberOfChannels: audio.numberOfChannels,
      channelData: audio.channelData.map(() => new Float32Array(0)),
      length: 0,
      duration: 0
    };
  }

  if (typeof OfflineAudioContext === 'undefined') {
    throw new AudioInspectError(
      'PROCESSING_ERROR',
      'OfflineAudioContext is not available for high-quality resampling'
    );
  }

  const targetLength = Math.max(1, Math.round((audio.length * targetSampleRate) / audio.sampleRate));
  const offlineContext = new OfflineAudioContext(
    audio.numberOfChannels,
    targetLength,
    targetSampleRate
  );
  const sourceBuffer = offlineContext.createBuffer(
    audio.numberOfChannels,
    audio.length,
    audio.sampleRate
  );

  for (let channelIndex = 0; channelIndex < audio.numberOfChannels; channelIndex++) {
    const sourceChannel = audio.channelData[channelIndex] ?? new Float32Array(audio.length);
    sourceBuffer.copyToChannel(sourceChannel as Float32Array<ArrayBuffer>, channelIndex, 0);
  }

  const sourceNode = offlineContext.createBufferSource();
  sourceNode.buffer = sourceBuffer;
  sourceNode.connect(offlineContext.destination);
  sourceNode.start(0);

  const renderedBuffer = await offlineContext.startRendering();
  if (signal?.aborted) {
    throw new AudioInspectError('ABORTED', 'Operation aborted');
  }

  const renderedChannels: Float32Array[] = [];
  for (let channelIndex = 0; channelIndex < renderedBuffer.numberOfChannels; channelIndex++) {
    renderedChannels.push(renderedBuffer.getChannelData(channelIndex).slice());
  }

  return {
    sampleRate: renderedBuffer.sampleRate,
    numberOfChannels: renderedBuffer.numberOfChannels,
    channelData: renderedChannels,
    length: renderedBuffer.length,
    duration: renderedBuffer.duration
  };
}
