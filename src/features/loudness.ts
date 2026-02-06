import { AudioData, AudioInspectError, BiquadCoeffs } from '../types.js';
import { ensureValidSample } from '../core/utils.js';
// K-weightingフィルタの新しい実装をインポート
import { getKWeightingCoeffs as getKWeightingCoeffsImpl } from '../core/k-weighting-filter.js';

// ITU-R BS.1770-5準拠の定数
const ABSOLUTE_GATE_LUFS = -70.0;
const RELATIVE_GATE_LU = 10.0;
const BLOCK_SIZE_MS = 400;
const BLOCK_OVERLAP = 0.75; // 75%オーバーラップ
const SHORT_TERM_WINDOW_MS = 3000;
const MOMENTARY_WINDOW_MS = 400;

// Biquadフィルタの状態
interface BiquadState {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

// Biquadフィルタの適用
function applyBiquad(
  input: Float32Array,
  coeffs: BiquadCoeffs,
  state: BiquadState = { x1: 0, x2: 0, y1: 0, y2: 0 }
): Float32Array {
  const output = new Float32Array(input.length);
  let { x1, x2, y1, y2 } = state;

  for (let i = 0; i < input.length; i++) {
    const x0 = ensureValidSample(input[i] ?? 0);

    const y0 = coeffs.b0 * x0 + coeffs.b1 * x1 + coeffs.b2 * x2 - coeffs.a1 * y1 - coeffs.a2 * y2;

    output[i] = y0;

    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  // 状態を更新
  state.x1 = x1;
  state.x2 = x2;
  state.y1 = y1;
  state.y2 = y2;

  return output;
}

// ブロックのラウドネス計算
function calculateBlockLoudness(channels: Float32Array[]): number {
  let sumOfSquares = 0;
  const numChannels = channels.length;

  if (numChannels === 0) return -Infinity;

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = channels[ch];
    if (!channelData || channelData.length === 0) continue;

    let channelSum = 0;
    let validSamples = 0;

    for (let i = 0; i < channelData.length; i++) {
      const sample = ensureValidSample(channelData[i] ?? 0);
      channelSum += sample * sample;
      validSamples++;
    }

    if (validSamples === 0) continue;

    // チャンネル重み付け（ステレオの場合）
    const channelWeight = 1.0; // L, R, Cは1.0、Ls, Rsは1.41（サラウンドの場合）
    sumOfSquares += channelWeight * (channelSum / validSamples);
  }

  // LUFSに変換
  return -0.691 + 10 * Math.log10(Math.max(1e-15, sumOfSquares));
}

export interface LUFSOptions {
  channelMode?: 'mono' | 'stereo';
  gated?: boolean;
  calculateShortTerm?: boolean;
  calculateMomentary?: boolean;
  calculateLoudnessRange?: boolean;
  calculateTruePeak?: boolean;
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

function lufsBlocksToIntegrated(blocks: number[]): number {
  if (blocks.length === 0) {
    return -Infinity;
  }

  const sumPower = blocks.reduce((sum, lufs) => sum + Math.pow(10, (lufs + 0.691) / 10), 0);
  return -0.691 + 10 * Math.log10(sumPower / blocks.length);
}

/**
 * テスト用：K-weightingフィルタ係数を取得
 * @param sampleRate サンプルレート
 * @returns K-weightingフィルタ係数
 */
export function getKWeightingCoeffs(sampleRate: number): BiquadCoeffs[] {
  return getKWeightingCoeffsImpl(sampleRate);
}

export function getLUFS(audio: AudioData, options: LUFSOptions = {}): LUFSResult {
  const {
    channelMode = audio.numberOfChannels >= 2 ? 'stereo' : 'mono',
    gated = true,
    calculateShortTerm = false,
    calculateMomentary = false,
    calculateLoudnessRange = false,
    calculateTruePeak = false
  } = options;

  if (audio.numberOfChannels === 0) {
    throw new AudioInspectError('INVALID_INPUT', '処理可能なチャンネルがありません');
  }

  // getLUFSRealtimeを使用した実装
  const processor = getLUFSRealtime(audio.sampleRate, {
    channelMode,
    gated,
    maxDurationMs: audio.duration * 1000 + 5000 // 音声の長さ + 余裕
  });

  // チャンネルデータの準備
  const channelsToProcess: Float32Array[] = [];

  if (channelMode === 'mono') {
    const channel0 = audio.channelData[0];
    if (channel0) {
      channelsToProcess.push(channel0);
    }
  } else {
    // ステレオ処理
    const channel0 = audio.channelData[0];
    const channel1 = audio.channelData[1];
    if (channel0) channelsToProcess.push(channel0);
    if (channel1) channelsToProcess.push(channel1);
  }

  if (channelsToProcess.length === 0) {
    throw new AudioInspectError('INVALID_INPUT', '処理可能なチャンネルがありません');
  }

  // 短い音声（5秒未満）は一括処理、長い音声は500msチャンクで処理
  const chunks: Float32Array[][] = [];
  const length = channelsToProcess[0]!.length;

  if (audio.duration < 5.0) {
    // 短い音声は一括処理
    chunks.push(channelsToProcess);
  } else {
    // 長い音声は500msチャンクに分割
    const chunkSize = Math.floor(audio.sampleRate * 0.5);
    for (let i = 0; i < length; i += chunkSize) {
      const chunkEnd = Math.min(i + chunkSize, length);
      const chunk = channelsToProcess.map((ch) => ch.subarray(i, chunkEnd));
      chunks.push(chunk);
    }
  }

  // 時系列データ収集用（オプション機能のため）
  const momentaryValues: number[] = [];
  const shortTermValues: number[] = [];
  const collectShortTerm = calculateShortTerm || calculateLoudnessRange;

  // チャンクを順次処理
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

  // オプション機能の処理
  if (calculateShortTerm && shortTermValues.length > 0) {
    result.shortTerm = new Float32Array(shortTermValues);
  }

  if (calculateMomentary && momentaryValues.length > 0) {
    result.momentary = new Float32Array(momentaryValues);
  }

  // ラウドネスレンジ計算（short-termから）
  if (calculateLoudnessRange && shortTermValues.length > 0) {
    const validValues = shortTermValues
      .filter((v) => v > -70.0 && isFinite(v)) // 絶対ゲート
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

  // True Peak計算（簡易実装）
  if (calculateTruePeak) {
    result.truePeak = channelsToProcess.map((ch) => {
      let peak = 0;
      for (const sample of ch) {
        const sampleValue = ensureValidSample(sample ?? 0);
        peak = Math.max(peak, Math.abs(sampleValue));
      }
      return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
    });
  }

  return result;
}

// リアルタイム処理用の状態管理クラス
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
  private totalSamplesProcessed: number = 0; // 総処理サンプル数
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
        `サンプルレート ${sampleRate}Hz は低すぎてリアルタイムLUFS処理に対応していません。最低 ${Math.ceil(1000 / BLOCK_SIZE_MS)}Hz 以上が必要です。`
      );
    }

    this.hopSize = Math.floor(this.blockSize * (1 - BLOCK_OVERLAP));
    // 最大保持ブロック数（デフォルト30秒）
    this.maxBlocks = Math.ceil(maxDurationMs / ((this.hopSize / sampleRate) * 1000));

    // チャンネル数に応じてバッファを初期化
    const numChannels = channelMode === 'stereo' ? 2 : 1;
    for (let i = 0; i < numChannels; i++) {
      this.currentSamples.push(new Float32Array(this.blockSize));
      // K-weightingフィルタの状態（2段）
      this.biquadStates.push([
        { x1: 0, x2: 0, y1: 0, y2: 0 },
        { x1: 0, x2: 0, y1: 0, y2: 0 }
      ]);
    }
  }

  /**
   * 新しいオーディオチャンクを処理
   * @param chunk - 入力オーディオチャンク（チャンネルごとのFloat32Array配列）
   * @returns 現在のLUFS値（integrated, momentary, shortTerm）
   */
  process(chunk: Float32Array[]): { integrated: number; momentary: number; shortTerm: number } {
    const numChannels = this.channelMode === 'stereo' ? Math.min(chunk.length, 2) : 1;
    const coeffs = getKWeightingCoeffsImpl(this.sampleRate);

    // 入力データの長さを確認（全チャンネル同じ長さと仮定）
    const inputLength = chunk[0]?.length || 0;
    if (inputLength === 0) {
      return this.calculateCurrentLUFS();
    }

    // 各チャンネルのフィルタ処理を先に行う
    const filteredChannels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      const inputData = chunk[ch];
      if (!inputData) continue;

      // K-weightingフィルタを適用（状態を保持）
      let filtered = applyBiquad(inputData, coeffs[0]!, this.biquadStates[ch]![0]!);
      filtered = applyBiquad(filtered, coeffs[1]!, this.biquadStates[ch]![1]!);
      filteredChannels.push(filtered);
    }

    // サンプル単位でバッファ処理（チャンネル間で同期）
    let processedSamples = 0;
    while (processedSamples < inputLength) {
      const remainingSpace = this.blockSize - this.sampleCount;
      const samplesToAdd = Math.min(inputLength - processedSamples, remainingSpace);

      // 各チャンネルのデータを同時にバッファに追加
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

      // サンプルカウントを一度だけ更新
      this.sampleCount += samplesToAdd;
      processedSamples += samplesToAdd;

      // ブロックが完成したら処理
      if (this.sampleCount >= this.blockSize) {
        // ブロックのラウドネスを計算
        const blockLoudness = calculateBlockLoudness(this.currentSamples.slice(0, numChannels));
        if (isFinite(blockLoudness)) {
          // サンプルインデックスを記録（ブロック中心位置）
          const blockCenterSample = this.totalSamplesProcessed + this.blockSize / 2;
          this.blockBuffer.push([blockLoudness, blockCenterSample]);

          // 古いブロックを削除
          if (this.blockBuffer.length > this.maxBlocks) {
            this.blockBuffer.shift();
          }
        }

        // 全チャンネルのオーバーラップ部分をシフト
        for (let ch = 0; ch < numChannels; ch++) {
          const currentBuffer = this.currentSamples[ch]!;
          currentBuffer.copyWithin(0, this.hopSize);
        }

        this.sampleCount = this.blockSize - this.hopSize;
        this.totalSamplesProcessed += this.hopSize;
      }
    }

    // 現在のLUFS値を計算
    return this.calculateCurrentLUFS();
  }

  /**
   * 現在の統合ラウドネスを計算
   */
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
      // 絶対ゲート（-70 LUFS）
      const absoluteGated = integratedBlocks.filter((l) => l >= ABSOLUTE_GATE_LUFS);
      if (absoluteGated.length > 0) {
        // 相対ゲートのしきい値を計算
        const meanLoudness = lufsBlocksToIntegrated(absoluteGated);
        const relativeThreshold = meanLoudness - RELATIVE_GATE_LU;

        // 相対ゲート適用
        const relativeGated = absoluteGated.filter((l) => l >= relativeThreshold);
        integrated = lufsBlocksToIntegrated(relativeGated);
      }
    }

    // Momentary計算
    let momentary = -Infinity;
    if (momentaryBlocks.length > 0) {
      const sumPower = momentaryBlocks.reduce(
        (sum, lufs) => sum + Math.pow(10, (lufs + 0.691) / 10),
        0
      );
      momentary = -0.691 + 10 * Math.log10(sumPower / momentaryBlocks.length);
    }

    // Short-term計算
    let shortTerm = -Infinity;
    if (shortTermBlocks.length > 0) {
      const sumPower = shortTermBlocks.reduce(
        (sum, lufs) => sum + Math.pow(10, (lufs + 0.691) / 10),
        0
      );
      shortTerm = -0.691 + 10 * Math.log10(sumPower / shortTermBlocks.length);
    }

    return { integrated, momentary, shortTerm };
  }

  /**
   * 状態をリセット
   */
  reset(): void {
    this.blockBuffer = [];
    this.sampleCount = 0;
    this.totalSamplesProcessed = 0;

    // バッファとフィルタ状態をクリア
    for (let i = 0; i < this.currentSamples.length; i++) {
      this.currentSamples[i]!.fill(0);
      for (let j = 0; j < this.biquadStates[i]!.length; j++) {
        this.biquadStates[i]![j] = { x1: 0, x2: 0, y1: 0, y2: 0 };
      }
    }
  }

  /**
   * 現在のブロックバッファ数を取得
   */
  getBufferSize(): number {
    return this.blockBuffer.length;
  }
}

export interface RealtimeLUFSOptions {
  channelMode?: 'mono' | 'stereo';
  gated?: boolean;
  maxDurationMs?: number; // 最大保持時間（デフォルト30秒）
}

/**
 * リアルタイムLUFS処理器を取得
 * @param sampleRate サンプルレート
 * @param options 処理オプション
 * @returns リアルタイムLUFS処理器
 */
export function getLUFSRealtime(
  sampleRate: number,
  options: RealtimeLUFSOptions = {}
): RealtimeLUFSProcessor {
  const { channelMode = 'stereo', maxDurationMs = 30000, gated = true } = options;
  return new RealtimeLUFSProcessor(sampleRate, channelMode, maxDurationMs, gated);
}
