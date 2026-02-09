import { AudioData, AudioInspectError, BiquadCoeffs } from '../types.js';
import { getTruePeak } from '../core/dsp/oversampling.js';
import { ampToDb, powToDb } from '../core/dsp/db.js';

import { getKWeightingCoeffs as getKWeightingCoeffsImpl } from '../core/dsp/k-weighting.js';

// ITU-R BS.1770 gating and block-analysis constants.
const ABSOLUTE_GATE_LUFS = -70.0;
const RELATIVE_GATE_LU = 10.0;
const BLOCK_SIZE_MS = 400;
const BLOCK_OVERLAP = 0.75;
const SHORT_TERM_WINDOW_MS = 3000;
const MOMENTARY_WINDOW_MS = 400;

// Stateful biquad memory for streaming processing.
interface BiquadState {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

// Process one biquad section and update filter state.
function applyBiquad(
  input: Float32Array,
  coeffs: BiquadCoeffs,
  state: BiquadState = { x1: 0, x2: 0, y1: 0, y2: 0 }
): Float32Array {
  const output = new Float32Array(input.length);
  let { x1, x2, y1, y2 } = state;

  for (let i = 0; i < input.length; i++) {
    const x0 = input[i]!;

    const y0 = coeffs.b0 * x0 + coeffs.b1 * x1 + coeffs.b2 * x2 - coeffs.a1 * y1 - coeffs.a2 * y2;

    output[i] = y0;

    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  // Persist filter state for the next chunk.
  state.x1 = x1;
  state.x2 = x2;
  state.y1 = y1;
  state.y2 = y2;

  return output;
}

// Calculate LUFS-equivalent loudness for one weighted block.
function calculateBlockLoudness(channels: Float32Array[]): number {
  let sumOfSquares = 0;
  const numChannels = channels.length;

  if (numChannels === 0) return -Infinity;

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = channels[ch];
    if (!channelData || channelData.length === 0) continue;

    let channelSum = 0;

    for (let i = 0; i < channelData.length; i++) {
      const sample = channelData[i]!;
      channelSum += sample * sample;
    }

    if (channelData.length === 0) continue;

    // BS.1770 channel weighting can be extended here for multichannel layouts.
    const channelWeight = 1.0;
    sumOfSquares += channelWeight * (channelSum / channelData.length);
  }

  // -0.691 is the BS.1770 calibration offset.
  return -0.691 + powToDb(Math.max(1e-15, sumOfSquares), 1);
}

// Offline LUFS request options.
export interface LUFSOptions {
  channelMode?: 'mono' | 'stereo';
  gated?: boolean;
  calculateShortTerm?: boolean;
  calculateMomentary?: boolean;
  calculateLoudnessRange?: boolean;
  calculateTruePeak?: boolean;
  truePeakOversamplingFactor?: 2 | 4 | 8;
  truePeakInterpolation?: 'linear' | 'cubic' | 'sinc';
}

export interface LUFSResult {
  integrated: number; // Integrated loudness (LUFS)
  shortTerm?: Float32Array; // Short-term loudness values
  momentary?: Float32Array; // Momentary loudness values
  loudnessRange?: number; // Loudness range (LU)
  truePeak?: number[]; // True peak per channel (dBTP)
  statistics?: {
    percentile10: number; // 10th percentile
    percentile95: number; // 95th percentile
  };
}

// Convert block LUFS values to integrated LUFS.
function lufsBlocksToIntegrated(blocks: number[]): number {
  if (blocks.length === 0) {
    return -Infinity;
  }

  const sumPower = blocks.reduce((sum, lufs) => sum + Math.pow(10, (lufs + 0.691) / 10), 0);
  return -0.691 + powToDb(sumPower / blocks.length, 1);
}

// Expose K-weighting coefficients for tests and diagnostics.
export function getKWeightingCoeffs(sampleRate: number): BiquadCoeffs[] {
  return getKWeightingCoeffsImpl(sampleRate);
}

// Compute LUFS metrics for an in-memory AudioData object.
export function getLUFS(audio: AudioData, options: LUFSOptions = {}): LUFSResult {
  const {
    channelMode = audio.numberOfChannels >= 2 ? 'stereo' : 'mono',
    gated = true,
    calculateShortTerm = false,
    calculateMomentary = false,
    calculateLoudnessRange = false,
    calculateTruePeak = false,
    truePeakOversamplingFactor = 4,
    truePeakInterpolation = 'sinc'
  } = options;

  if (audio.numberOfChannels === 0) {
    throw new AudioInspectError('INVALID_INPUT', 'No processable channels available');
  }

  // Reuse the realtime processor so offline and realtime behavior stays aligned.
  const processor = getLUFSRealtime(audio.sampleRate, {
    channelMode,
    gated,
    maxDurationMs: audio.duration * 1000 + 5000
  });

  // Resolve channels according to requested channel mode.
  const channelsToProcess: Float32Array[] = [];

  if (channelMode === 'mono') {
    const channel0 = audio.channelData[0];
    if (channel0) {
      channelsToProcess.push(channel0);
    }
  } else {
    const channel0 = audio.channelData[0];
    const channel1 = audio.channelData[1];
    if (channel0) channelsToProcess.push(channel0);
    if (channel1) channelsToProcess.push(channel1);
  }

  if (channelsToProcess.length === 0) {
    throw new AudioInspectError('INVALID_INPUT', 'No processable channels available');
  }

  // Process in hop-sized chunks (100 ms with current constants).
  const chunks: Float32Array[][] = [];
  const length = channelsToProcess[0]!.length;
  const chunkDurationMs = BLOCK_SIZE_MS * (1 - BLOCK_OVERLAP); // 100ms
  const chunkSize = Math.max(1, Math.floor((chunkDurationMs / 1000) * audio.sampleRate));

  for (let i = 0; i < length; i += chunkSize) {
    const chunkEnd = Math.min(i + chunkSize, length);
    const chunk = channelsToProcess.map((ch) => ch.subarray(i, chunkEnd));
    chunks.push(chunk);
  }

  // Collect optional time-series metrics while iterating.
  const momentaryValues: number[] = [];
  const shortTermValues: number[] = [];
  const collectShortTerm = calculateShortTerm || calculateLoudnessRange;

  // Run chunked analysis.
  let finalResult;
  for (const chunk of chunks) {
    finalResult = processor.process(chunk);

    if (calculateMomentary && isFinite(finalResult.momentary)) {
      momentaryValues.push(finalResult.momentary);
    }

    if (collectShortTerm && isFinite(finalResult.shortTerm)) {
      shortTermValues.push(finalResult.shortTerm);
    }
  }

  const result: LUFSResult = {
    integrated: finalResult?.integrated ?? -Infinity
  };

  // Optional short-term and momentary outputs.
  if (calculateShortTerm && shortTermValues.length > 0) {
    result.shortTerm = new Float32Array(shortTermValues);
  }

  if (calculateMomentary && momentaryValues.length > 0) {
    result.momentary = new Float32Array(momentaryValues);
  }

  // Loudness range is derived from short-term loudness percentiles.
  if (calculateLoudnessRange && shortTermValues.length > 0) {
    const validValues = shortTermValues
      .filter((v) => v > -70.0 && isFinite(v))
      .sort((a, b) => a - b);

    if (validValues.length > 0) {
      const percentile10Index = Math.floor(validValues.length * 0.1);
      const percentile95Index = Math.floor(validValues.length * 0.95);

      const percentile10 = validValues[percentile10Index] ?? -Infinity;
      const percentile95 = validValues[percentile95Index] ?? -Infinity;

      result.loudnessRange = percentile95 - percentile10;
      result.statistics = { percentile10, percentile95 };
    }
  }

  // Optional true-peak output per processed channel.
  if (calculateTruePeak) {
    result.truePeak = channelsToProcess.map((ch) => {
      const truePeak = getTruePeak(ch, {
        factor: truePeakOversamplingFactor,
        interpolation: truePeakInterpolation
      });
      return ampToDb(truePeak, 1);
    });
  }

  return result;
}

// Stateful realtime LUFS processor for streaming chunks.
class RealtimeLUFSProcessor {
  private sampleRate: number;
  private channelMode: 'mono' | 'stereo';
  private blockSize: number;
  private hopSize: number;
  private blockBuffer: Array<[number, number]> = []; // [loudness, sampleIndex]
  private maxBlocks: number;
  private currentSamples: Float32Array[] = [];
  private sampleCount: number = 0;
  private biquadStates: BiquadState[][] = [];
  private totalSamplesProcessed: number = 0;
  private gated: boolean;

  constructor(
    sampleRate: number,
    channelMode: 'mono' | 'stereo' = 'stereo',
    maxDurationMs: number = 30000,
    gated: boolean = true
  ) {
    this.sampleRate = sampleRate;
    this.channelMode = channelMode;
    this.gated = gated;
    this.blockSize = Math.floor((BLOCK_SIZE_MS / 1000) * sampleRate);

    // Ensure blockSize is at least 1 to prevent division by zero
    if (this.blockSize === 0) {
      throw new AudioInspectError(
        'INVALID_INPUT',
        `Sample rate ${sampleRate} Hz is too low for realtime LUFS processing. Minimum required sample rate is ${Math.ceil(1000 / BLOCK_SIZE_MS)} Hz.`
      );
    }

    this.hopSize = Math.floor(this.blockSize * (1 - BLOCK_OVERLAP));
    // Bound the retained block history by maxDurationMs.
    this.maxBlocks = Math.ceil(maxDurationMs / ((this.hopSize / sampleRate) * 1000));

    // Allocate per-channel scratch buffers and filter states.
    const numChannels = channelMode === 'stereo' ? 2 : 1;
    for (let i = 0; i < numChannels; i++) {
      this.currentSamples.push(new Float32Array(this.blockSize));
      this.biquadStates.push([
        { x1: 0, x2: 0, y1: 0, y2: 0 },
        { x1: 0, x2: 0, y1: 0, y2: 0 }
      ]);
    }
  }

  // Push one chunk and return the current LUFS snapshot.
  process(chunk: Float32Array[]): { integrated: number; momentary: number; shortTerm: number } {
    const numChannels = this.channelMode === 'stereo' ? Math.min(chunk.length, 2) : 1;
    const coeffs = getKWeightingCoeffsImpl(this.sampleRate);

    // Empty chunk: return the latest snapshot without state changes.
    const inputLength = chunk[0]?.length || 0;
    if (inputLength === 0) {
      return this.calculateCurrentLUFS();
    }

    // Apply two-stage K-weighting to each channel.
    const filteredChannels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      const inputData = chunk[ch];
      if (!inputData) continue;

      let filtered = applyBiquad(inputData, coeffs[0]!, this.biquadStates[ch]![0]!);
      filtered = applyBiquad(filtered, coeffs[1]!, this.biquadStates[ch]![1]!);
      filteredChannels.push(filtered);
    }

    // Fill block buffers and emit overlapping blocks.
    let processedSamples = 0;
    while (processedSamples < inputLength) {
      const remainingSpace = this.blockSize - this.sampleCount;
      const samplesToAdd = Math.min(inputLength - processedSamples, remainingSpace);

      for (let ch = 0; ch < numChannels; ch++) {
        const filtered = filteredChannels[ch];
        const currentBuffer = this.currentSamples[ch]!;
        if (filtered) {
          currentBuffer.set(
            filtered.subarray(processedSamples, processedSamples + samplesToAdd),
            this.sampleCount
          );
        }
      }

      this.sampleCount += samplesToAdd;
      processedSamples += samplesToAdd;

      if (this.sampleCount >= this.blockSize) {
        const blockLoudness = calculateBlockLoudness(this.currentSamples.slice(0, numChannels));
        if (isFinite(blockLoudness)) {
          // Use block center sample for window-based lookups.
          const blockCenterSample = this.totalSamplesProcessed + this.blockSize / 2;
          this.blockBuffer.push([blockLoudness, blockCenterSample]);

          if (this.blockBuffer.length > this.maxBlocks) {
            this.blockBuffer.shift();
          }
        }

        // Shift overlap region for the next block.
        for (let ch = 0; ch < numChannels; ch++) {
          const currentBuffer = this.currentSamples[ch]!;
          currentBuffer.copyWithin(0, this.hopSize);
        }

        this.sampleCount = this.blockSize - this.hopSize;
        this.totalSamplesProcessed += this.hopSize;
      }
    }

    return this.calculateCurrentLUFS();
  }

  // Compute integrated, momentary, and short-term loudness from buffered blocks.
  private calculateCurrentLUFS(): { integrated: number; momentary: number; shortTerm: number } {
    if (this.blockBuffer.length === 0) {
      return { integrated: -Infinity, momentary: -Infinity, shortTerm: -Infinity };
    }

    const currentSample = this.totalSamplesProcessed + this.sampleCount;
    const momentarySamples = (MOMENTARY_WINDOW_MS / 1000) * this.sampleRate;
    const shortTermSamples = (SHORT_TERM_WINDOW_MS / 1000) * this.sampleRate;

    // Momentary (400ms)
    const momentaryBlocks = this.blockBuffer
      .filter(([_, sampleIndex]) => currentSample - sampleIndex <= momentarySamples)
      .map(([loudness]) => loudness);

    // Short-term (3s)
    const shortTermBlocks = this.blockBuffer
      .filter(([_, sampleIndex]) => currentSample - sampleIndex <= shortTermSamples)
      .map(([loudness]) => loudness);

    let integrated = -Infinity;
    const integratedBlocks = this.blockBuffer
      .map(([loudness]) => loudness)
      .filter((loudness) => isFinite(loudness));
    if (!this.gated) {
      integrated = lufsBlocksToIntegrated(integratedBlocks);
    } else if (integratedBlocks.length > 0) {
      // Apply absolute gate first.
      const absoluteGated = integratedBlocks.filter((l) => l >= ABSOLUTE_GATE_LUFS);
      if (absoluteGated.length > 0) {
        // Then apply relative gate (10 LU below ungated mean).
        const meanLoudness = lufsBlocksToIntegrated(absoluteGated);
        const relativeThreshold = meanLoudness - RELATIVE_GATE_LU;

        const relativeGated = absoluteGated.filter((l) => l >= relativeThreshold);
        integrated = lufsBlocksToIntegrated(relativeGated);
      }
    }

    // Compute momentary loudness (400 ms window).
    let momentary = -Infinity;
    if (momentaryBlocks.length > 0) {
      const sumPower = momentaryBlocks.reduce(
        (sum, lufs) => sum + Math.pow(10, (lufs + 0.691) / 10),
        0
      );
      momentary = -0.691 + powToDb(sumPower / momentaryBlocks.length, 1);
    }

    // Compute short-term loudness (3 s window).
    let shortTerm = -Infinity;
    if (shortTermBlocks.length > 0) {
      const sumPower = shortTermBlocks.reduce(
        (sum, lufs) => sum + Math.pow(10, (lufs + 0.691) / 10),
        0
      );
      shortTerm = -0.691 + powToDb(sumPower / shortTermBlocks.length, 1);
    }

    return { integrated, momentary, shortTerm };
  }

  // Reset state for a new stream.
  reset(): void {
    this.blockBuffer = [];
    this.sampleCount = 0;
    this.totalSamplesProcessed = 0;

    for (let i = 0; i < this.currentSamples.length; i++) {
      this.currentSamples[i]!.fill(0);
      for (let j = 0; j < this.biquadStates[i]!.length; j++) {
        this.biquadStates[i]![j] = { x1: 0, x2: 0, y1: 0, y2: 0 };
      }
    }
  }

  // Expose internal buffer size for tests.
  getBufferSize(): number {
    return this.blockBuffer.length;
  }
}

export interface RealtimeLUFSOptions {
  channelMode?: 'mono' | 'stereo';
  gated?: boolean;
  maxDurationMs?: number;
}

// Create a reusable realtime LUFS processor.
export function getLUFSRealtime(
  sampleRate: number,
  options: RealtimeLUFSOptions = {}
): RealtimeLUFSProcessor {
  const { channelMode = 'stereo', maxDurationMs = 30000, gated = true } = options;
  return new RealtimeLUFSProcessor(sampleRate, channelMode, maxDurationMs, gated);
}
