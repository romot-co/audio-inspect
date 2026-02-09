import { AudioInspectError, type AudioData } from '../../types.js';
import {
  getLUFSRealtime,
  type LUFSOptions,
  type LUFSResult
} from '../../features/loudness.js';
import { getTruePeak } from '../dsp/oversampling.js';
import { ampToDb } from '../dsp/db.js';

type RealtimeProcessor = ReturnType<typeof getLUFSRealtime>;

// Reuse realtime processors when sample rate / gating configuration matches.
function buildProcessorKey(sampleRate: number, options: LUFSOptions): string {
  const channelMode = options.channelMode ?? 'stereo';
  const gated = options.gated ?? true;
  return `${sampleRate}|${channelMode}|${gated ? 1 : 0}`;
}

// Resolve channels according to mono/stereo processing mode.
function resolveRealtimeChannels(audio: AudioData, channelMode: 'mono' | 'stereo'): Float32Array[] {
  if (audio.numberOfChannels === 0) {
    throw new AudioInspectError('INVALID_INPUT', 'No processable channels available');
  }

  const left = audio.channelData[0];
  if (!left) {
    throw new AudioInspectError('INVALID_INPUT', 'No processable channels available');
  }

  if (channelMode === 'mono') {
    return [left];
  }

  const right = audio.channelData[1] ?? left;
  return [left, right];
}

// Convert processor snapshot to public LUFS output shape.
function mapSnapshotToResult(
  audio: AudioData,
  channels: Float32Array[],
  options: LUFSOptions,
  snapshot: { integrated: number; momentary: number; shortTerm: number }
): LUFSResult {
  const result: LUFSResult = {
    integrated: snapshot.integrated
  };

  if (options.calculateMomentary) {
    result.momentary = new Float32Array([snapshot.momentary]);
  }

  if (options.calculateShortTerm || options.calculateLoudnessRange) {
    result.shortTerm = new Float32Array([snapshot.shortTerm]);
  }

  if (options.calculateLoudnessRange && Number.isFinite(snapshot.shortTerm)) {
    result.loudnessRange = 0;
    result.statistics = {
      percentile10: snapshot.shortTerm,
      percentile95: snapshot.shortTerm
    };
  }

  if (options.calculateTruePeak) {
    const oversamplingFactor = options.truePeakOversamplingFactor ?? 4;
    const interpolation = options.truePeakInterpolation ?? 'sinc';
    result.truePeak = channels.map((channelData) => {
      const truePeak = getTruePeak(channelData, {
        factor: oversamplingFactor,
        interpolation
      });
      return ampToDb(truePeak, 1);
    });
  }

  // Keep output stable for mono inputs where channelMode resolves to stereo.
  if ((options.channelMode ?? 'stereo') === 'stereo' && audio.numberOfChannels === 1 && result.truePeak) {
    result.truePeak = [result.truePeak[0] ?? -Infinity, result.truePeak[1] ?? result.truePeak[0] ?? -Infinity];
  }

  return result;
}

export class RealtimeLUFSExecutor {
  private processor: RealtimeProcessor | null = null;
  private processorKey: string | null = null;

  process(audio: AudioData, options: LUFSOptions = {}): LUFSResult {
    const channelMode = options.channelMode ?? (audio.numberOfChannels >= 2 ? 'stereo' : 'mono');
    const key = buildProcessorKey(audio.sampleRate, {
      ...options,
      channelMode
    });

    if (!this.processor || this.processorKey !== key) {
      // Processor config is intentionally narrow and stream-oriented.
      this.processor = getLUFSRealtime(audio.sampleRate, {
        channelMode,
        gated: options.gated ?? true,
        maxDurationMs: 60000
      });
      this.processorKey = key;
    }

    const channels = resolveRealtimeChannels(audio, channelMode);
    const snapshot = this.processor.process(channels);
    return mapSnapshotToResult(audio, channels, options, snapshot);
  }

  reset(): void {
    if (this.processor) {
      this.processor.reset();
    }
  }

  dispose(): void {
    this.processor = null;
    this.processorKey = null;
  }
}
