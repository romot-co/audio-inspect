import {
  AudioData,
  AmplitudeOptions,
  AudioInspectError,
  type ChannelSelector,
  WaveformAnalysisResult,
  PeaksAnalysisResult,
  RMSAnalysisResult,
  ProgressOptions
} from '../types.js';
import {
  getChannelData,
  ensureValidSample,
  isValidSample,
  amplitudeToDecibels,
  safeArrayAccess,
  getTruePeak,
  getPerformanceNow
} from '../core/utils.js';

/**
 * ピーク検出のオプション
 */
export interface PeaksOptions {
  /** 抽出するピークの数（デフォルト: 100） */
  count?: number;
  /** ピーク検出の閾値（0-1、デフォルト: 0.1） */
  threshold?: number;
  /** 解析するチャンネル（デフォルト: 0） */
  channel?: ChannelSelector;
  /** 最小ピーク間距離（サンプル数、デフォルト: サンプルレート/100） */
  minDistance?: number;
}

/**
 * ピーク情報
 */
export interface Peak {
  /** ピークの位置（サンプル数） */
  position: number;
  /** ピークの時間位置（秒） */
  time: number;
  /** ピークの振幅（0-1） */
  amplitude: number;
}

/**
 * ピーク検出結果
 */
export interface PeaksResult {
  /** 検出されたピーク */
  peaks: Peak[];
  /** 最大振幅 */
  maxAmplitude: number;
  /** 平均振幅 */
  averageAmplitude: number;
}

interface PeakCandidate {
  position: number;
  amplitude: number;
  prominence?: number; // ピークの顕著性（オプション）
}

// より洗練されたピーク検出アルゴリズム
function detectAllInitialPeaks(
  data: Float32Array,
  threshold: number,
  includeProminence: boolean = false
): PeakCandidate[] {
  const peaks: PeakCandidate[] = [];
  const length = data.length;

  if (length < 3) return peaks; // 最低3サンプル必要

  for (let i = 1; i < length - 1; i++) {
    const current = Math.abs(ensureValidSample(data[i] ?? 0));
    const prev = Math.abs(ensureValidSample(data[i - 1] ?? 0));
    const next = Math.abs(ensureValidSample(data[i + 1] ?? 0));

    // ローカルマキシマムかつ閾値を超えているか
    if (current > prev && current > next && current > threshold) {
      const peak: PeakCandidate = {
        position: i,
        amplitude: current
      };

      // オプション：ピークの顕著性を計算
      if (includeProminence) {
        peak.prominence = calculateProminence(data, i, current);
      }

      peaks.push(peak);
    }
  }

  return peaks;
}

// ピークの顕著性を計算（オプション機能）
function calculateProminence(data: Float32Array, peakIndex: number, peakValue: number): number {
  // 左側の最小値を探索
  let leftMin = peakValue;
  for (let i = peakIndex - 1; i >= 0; i--) {
    const value = Math.abs(ensureValidSample(data[i] ?? 0));
    if (value > peakValue) break; // より高いピークに到達
    leftMin = Math.min(leftMin, value);
  }

  // 右側の最小値を探索
  let rightMin = peakValue;
  for (let i = peakIndex + 1; i < data.length; i++) {
    const value = Math.abs(ensureValidSample(data[i] ?? 0));
    if (value > peakValue) break; // より高いピークに到達
    rightMin = Math.min(rightMin, value);
  }

  return peakValue - Math.max(leftMin, rightMin);
}

/**
 * ピーク検出を行う
 */
export function getPeaks(audio: AudioData, options: PeaksOptions = {}): PeaksResult {
  const {
    count = 100,
    threshold = 0.1,
    channel = 0,
    minDistance = Math.floor(audio.sampleRate / 100) // デフォルト10ms
  } = options;

  if (count <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'ピーク数は正の整数である必要があります');
  }

  if (threshold < 0 || threshold > 1) {
    throw new AudioInspectError('INVALID_INPUT', '閾値は0から1の範囲である必要があります');
  }

  const channelData = getChannelData(audio, channel);

  if (channelData.length === 0) {
    return {
      peaks: [],
      maxAmplitude: 0,
      averageAmplitude: 0
    };
  }

  // 1. すべての初期ピーク候補を検出
  const allInitialPeaks = detectAllInitialPeaks(channelData, threshold);

  if (allInitialPeaks.length === 0) {
    return {
      peaks: [],
      maxAmplitude: 0,
      averageAmplitude: 0
    };
  }

  // 2. 振幅の降順でソート
  allInitialPeaks.sort((a, b) => b.amplitude - a.amplitude);

  // 3. 空間的フィルタリング（最小距離制約）
  const selectedPeaks: Peak[] = [];
  const occupiedRegions: Array<[number, number]> = []; // [start, end]の配列

  for (const candidate of allInitialPeaks) {
    if (selectedPeaks.length >= count) break;

    // 占有領域との重複をチェック
    const candidateStart = candidate.position - minDistance;
    const candidateEnd = candidate.position + minDistance;

    const hasOverlap = occupiedRegions.some(
      ([start, end]) => !(candidateEnd < start || candidateStart > end)
    );

    if (!hasOverlap) {
      selectedPeaks.push({
        position: candidate.position,
        time: candidate.position / audio.sampleRate,
        amplitude: candidate.amplitude
      });

      occupiedRegions.push([candidateStart, candidateEnd]);
    }
  }

  // 4. 時間順でソート
  selectedPeaks.sort((a, b) => a.position - b.position);

  // 5. 統計情報の計算（すべての候補から）
  const maxAmplitude = allInitialPeaks.length > 0 ? (allInitialPeaks[0]?.amplitude ?? 0) : 0;
  const averageAmplitude =
    allInitialPeaks.length > 0
      ? allInitialPeaks.reduce((sum, p) => sum + p.amplitude, 0) / allInitialPeaks.length
      : 0;

  return {
    peaks: selectedPeaks,
    maxAmplitude,
    averageAmplitude
  };
}

// 定数定義
const SILENCE_DB = -Infinity;

/**
 * RMS（Root Mean Square）を計算
 */
export function getRMS(audio: AudioData, optionsOrChannel: AmplitudeOptions | number = {}): number {
  const options =
    typeof optionsOrChannel === 'number'
      ? {
          channel: optionsOrChannel,
          asDB: false,
          reference: 1.0,
          truePeak: false,
          oversamplingFactor: 4,
          interpolation: 'cubic' as const
        }
      : {
          channel: optionsOrChannel.channel ?? 0,
          asDB: optionsOrChannel.asDB ?? false,
          reference: optionsOrChannel.reference ?? 1.0,
          truePeak: optionsOrChannel.truePeak ?? false,
          oversamplingFactor: optionsOrChannel.oversamplingFactor ?? 4,
          interpolation: optionsOrChannel.interpolation ?? ('cubic' as const)
        };

  const channelData = getChannelData(audio, options.channel);

  if (channelData.length === 0) {
    return options.asDB ? SILENCE_DB : 0;
  }

  // RMS計算（数値的安定性を考慮）
  let sumOfSquares = 0;
  let validSampleCount = 0;

  for (let i = 0; i < channelData.length; i++) {
    const sample = channelData[i] ?? 0;
    if (isValidSample(sample)) {
      sumOfSquares += sample * sample;
      validSampleCount++;
    }
  }

  if (validSampleCount === 0) {
    return options.asDB ? SILENCE_DB : 0;
  }

  const rms = Math.sqrt(sumOfSquares / validSampleCount);

  return options.asDB ? amplitudeToDecibels(rms, options.reference) : rms;
}

/**
 * ピーク振幅を計算
 */
export function getPeakAmplitude(audio: AudioData, options: AmplitudeOptions = {}): number {
  const resolvedOptions = {
    channel: options.channel ?? 0,
    asDB: options.asDB ?? false,
    reference: options.reference ?? 1.0,
    truePeak: options.truePeak ?? false,
    oversamplingFactor: options.oversamplingFactor ?? 4,
    interpolation: options.interpolation ?? ('cubic' as const)
  };

  const channelData = getChannelData(audio, resolvedOptions.channel);

  if (channelData.length === 0) {
    return resolvedOptions.asDB ? SILENCE_DB : 0;
  }

  let peak: number;

  if (resolvedOptions.truePeak) {
    // True Peak検出
    peak = getTruePeak(channelData, {
      factor: resolvedOptions.oversamplingFactor,
      interpolation: resolvedOptions.interpolation
    });
  } else {
    // 通常のピーク検出
    peak = 0;
    for (let i = 0; i < channelData.length; i++) {
      const sample = channelData[i] ?? 0;
      if (isValidSample(sample)) {
        peak = Math.max(peak, Math.abs(sample));
      }
    }
  }

  return resolvedOptions.asDB ? amplitudeToDecibels(peak, resolvedOptions.reference) : peak;
}

// エイリアスとしてgetPeakをエクスポート
export { getPeakAmplitude as getPeak };

/**
 * ゼロクロッシング率を計算
 */
export function getZeroCrossing(audio: AudioData, channel: ChannelSelector = 0): number {
  const channelData = getChannelData(audio, channel);

  if (channelData.length < 2) {
    return 0;
  }

  let crossings = 0;
  for (let i = 1; i < channelData.length; i++) {
    const prev = ensureValidSample(channelData[i - 1] ?? 0);
    const current = ensureValidSample(channelData[i] ?? 0);

    // 符号が変わった場合はゼロクロッシング
    if ((prev >= 0 && current < 0) || (prev < 0 && current >= 0)) {
      crossings++;
    }
  }

  return crossings / (channelData.length - 1);
}

/**
 * 波形データ取得のオプション
 */
export interface WaveformOptions {
  /** 1秒あたりのサンプル数（解像度、デフォルト: 60） */
  framesPerSecond?: number;
  /** 解析するチャンネル（デフォルト: 0） */
  channel?: ChannelSelector;
  /** 振幅の計算方法（デフォルト: 'rms'） */
  method?: 'rms' | 'peak' | 'average';
}

/**
 * 波形データポイント
 */
export interface WaveformPoint {
  /** 時間位置（秒） */
  time: number;
  /** 振幅値（0-1） */
  amplitude: number; // nullを許容しない設計
}

/**
 * 波形データ取得結果
 */
export interface WaveformResult {
  /** 波形データポイントの配列 */
  waveform: WaveformPoint[];
  /** 最大振幅 */
  maxAmplitude: number;
  /** 平均振幅 */
  averageAmplitude: number;
  /** フレーム数 */
  frameCount: number;
  /** フレームあたりのサンプル数 */
  samplesPerFrame: number;
}

/**
 * 時間軸に沿った波形データを取得
 */
export function getWaveform(audio: AudioData, options: WaveformOptions = {}): WaveformResult {
  const { framesPerSecond = 60, channel = 0, method = 'rms' } = options;

  const channelData = getChannelData(audio, channel);

  // 修正2.3: 極端なフレーム数指定時の不具合対応
  // audio.length が0の場合は frameCount も0にする
  const desiredFrameCount = Math.ceil(audio.duration * framesPerSecond);
  const maxPossibleFrameCount = audio.length > 0 ? audio.length : desiredFrameCount > 0 ? 1 : 0;
  const frameCount = Math.min(desiredFrameCount, maxPossibleFrameCount);

  const samplesPerFrame = frameCount > 0 ? Math.max(1, Math.floor(audio.length / frameCount)) : 0;

  const waveform: WaveformPoint[] = [];
  let maxAmplitude = 0;
  let totalAmplitude = 0;

  for (let i = 0; i < frameCount; i++) {
    const startSample = i * samplesPerFrame;
    const endSample = Math.min(startSample + samplesPerFrame, channelData.length);

    // フレーム長が0または負の場合の処理
    if (endSample <= startSample) {
      // 最後の有効な振幅値を使用、または0
      const lastAmplitude =
        waveform.length > 0
          ? safeArrayAccess(waveform, waveform.length - 1, { time: 0, amplitude: 0 }).amplitude
          : 0;

      waveform.push({
        time: (startSample + samplesPerFrame / 2) / audio.sampleRate,
        amplitude: lastAmplitude
      });
      continue;
    }

    // フレームデータの処理
    const frameData = channelData.subarray(startSample, endSample); // sliceより効率的

    let amplitude: number;
    switch (method) {
      case 'peak':
        amplitude = calculatePeakAmplitude(frameData);
        break;
      case 'average':
        amplitude = calculateAverageAmplitude(frameData);
        break;
      case 'rms':
      default:
        amplitude = calculateRMSAmplitude(frameData);
        break;
    }

    const time = (startSample + (endSample - startSample) / 2) / audio.sampleRate;
    waveform.push({ time, amplitude });

    maxAmplitude = Math.max(maxAmplitude, amplitude);
    totalAmplitude += amplitude;
  }

  const averageAmplitude = frameCount > 0 ? totalAmplitude / frameCount : 0;

  return {
    waveform,
    maxAmplitude,
    averageAmplitude,
    frameCount,
    samplesPerFrame
  };
}

/**
 * フレーム内のRMS振幅を計算
 */
function calculateRMSAmplitude(frameData: Float32Array): number {
  if (frameData.length === 0) return 0;

  let sum = 0;
  for (let i = 0; i < frameData.length; i++) {
    const sample = ensureValidSample(frameData[i] ?? 0);
    sum += sample * sample;
  }
  return Math.sqrt(sum / frameData.length);
}

/**
 * フレーム内のピーク振幅を計算
 */
function calculatePeakAmplitude(frameData: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < frameData.length; i++) {
    const sample = Math.abs(ensureValidSample(frameData[i] ?? 0));
    peak = Math.max(peak, sample);
  }
  return peak;
}

/**
 * フレーム内の平均振幅を計算
 */
function calculateAverageAmplitude(frameData: Float32Array): number {
  if (frameData.length === 0) return 0;

  let sum = 0;
  for (let i = 0; i < frameData.length; i++) {
    sum += Math.abs(ensureValidSample(frameData[i] ?? 0));
  }
  return sum / frameData.length;
}

/**
 * 新しいWaveform解析オプション（プログレス通知対応）
 */
export interface WaveformAnalysisOptions extends ProgressOptions {
  /** 1秒あたりのサンプル数（解像度、デフォルト: 60） */
  framesPerSecond?: number;
  /** 解析するチャンネル（デフォルト: 0） */
  channel?: ChannelSelector;
  /** 振幅の計算方法（デフォルト: 'rms'） */
  method?: 'rms' | 'peak' | 'average';
}

/**
 * 新しいPeaks解析オプション（プログレス通知対応）
 */
export interface PeaksAnalysisOptions extends ProgressOptions {
  /** 抽出するピークの数（デフォルト: 100） */
  count?: number;
  /** ピーク検出の閾値（0-1、デフォルト: 0.1） */
  threshold?: number;
  /** 解析するチャンネル（デフォルト: 0） */
  channel?: ChannelSelector;
  /** 最小ピーク間距離（サンプル数、デフォルト: サンプルレート/100） */
  minDistance?: number;
}

/**
 * 新しいRMS解析オプション（プログレス通知対応）
 */
export interface RMSAnalysisOptions extends ProgressOptions {
  channel?: ChannelSelector;
  asDB?: boolean;
  reference?: number;
}

/**
 * 新しいWaveform解析（Float32Array対応）
 */
export function getWaveformAnalysis(
  audio: AudioData,
  options: WaveformAnalysisOptions = {}
): WaveformAnalysisResult {
  const startTime = getPerformanceNow();
  const { framesPerSecond = 60, channel = 0, method = 'rms', onProgress } = options;

  onProgress?.(0, 'Waveform解析を開始');

  const channelData = getChannelData(audio, channel);

  // フレーム数とサンプル数の計算
  const desiredFrameCount = Math.ceil(audio.duration * framesPerSecond);
  const maxPossibleFrameCount = audio.length > 0 ? audio.length : desiredFrameCount > 0 ? 1 : 0;
  const frameCount = Math.min(desiredFrameCount, maxPossibleFrameCount);
  const samplesPerFrame = frameCount > 0 ? Math.max(1, Math.floor(audio.length / frameCount)) : 0;

  onProgress?.(25, 'フレーム設定完了');

  // 結果配列を事前確保
  const amplitudes = new Float32Array(frameCount);
  const timestamps = new Float32Array(frameCount);

  let maxAmplitude = 0;
  let totalAmplitude = 0;

  onProgress?.(50, '振幅計算を開始');

  for (let i = 0; i < frameCount; i++) {
    const startSample = i * samplesPerFrame;
    const endSample = Math.min(startSample + samplesPerFrame, channelData.length);

    // フレーム長が0または負の場合の処理
    if (endSample <= startSample) {
      const lastAmplitude = i > 0 ? (amplitudes[i - 1] ?? 0) : 0;
      amplitudes[i] = lastAmplitude;
      timestamps[i] = (startSample + samplesPerFrame / 2) / audio.sampleRate;
      continue;
    }

    // フレームデータの処理
    const frameData = channelData.subarray(startSample, endSample);

    let amplitude: number;
    switch (method) {
      case 'peak':
        amplitude = calculatePeakAmplitude(frameData);
        break;
      case 'average':
        amplitude = calculateAverageAmplitude(frameData);
        break;
      case 'rms':
      default:
        amplitude = calculateRMSAmplitude(frameData);
        break;
    }

    amplitudes[i] = amplitude;
    timestamps[i] = (startSample + (endSample - startSample) / 2) / audio.sampleRate;

    maxAmplitude = Math.max(maxAmplitude, amplitude);
    totalAmplitude += amplitude;

    // プログレス更新
    if (i % Math.max(1, Math.floor(frameCount / 20)) === 0) {
      const progress = 50 + (i / frameCount) * 45;
      onProgress?.(Math.round(progress), `フレーム ${i + 1}/${frameCount} 処理中`);
    }
  }

  const averageAmplitude = frameCount > 0 ? totalAmplitude / frameCount : 0;
  const processingTime = getPerformanceNow() - startTime;

  onProgress?.(100, '処理完了');

  return {
    amplitudes,
    timestamps,
    frameCount,
    samplesPerFrame,
    framesPerSecond,
    maxAmplitude,
    averageAmplitude,
    sampleRate: audio.sampleRate,
    duration: audio.duration,
    processingTime
  };
}

/**
 * 新しいPeaks解析（Float32Array対応）
 */
export function getPeaksAnalysis(
  audio: AudioData,
  options: PeaksAnalysisOptions = {}
): PeaksAnalysisResult {
  const startTime = getPerformanceNow();
  const {
    count = 100,
    threshold = 0.1,
    channel = 0,
    minDistance = Math.floor(audio.sampleRate / 100),
    onProgress
  } = options;

  onProgress?.(0, 'Peaks解析を開始');

  if (count <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'ピーク数は正の整数である必要があります');
  }

  if (threshold < 0 || threshold > 1) {
    throw new AudioInspectError('INVALID_INPUT', '閾値は0から1の範囲である必要があります');
  }

  const channelData = getChannelData(audio, channel);

  if (channelData.length === 0) {
    return {
      positions: new Float32Array(0),
      amplitudes: new Float32Array(0),
      times: new Float32Array(0),
      maxAmplitude: 0,
      averageAmplitude: 0,
      count: 0,
      sampleRate: audio.sampleRate,
      duration: audio.duration,
      processingTime: getPerformanceNow() - startTime
    };
  }

  onProgress?.(25, 'ピーク候補を検出中');

  // 1. すべての初期ピーク候補を検出
  const allInitialPeaks = detectAllInitialPeaks(channelData, threshold);

  if (allInitialPeaks.length === 0) {
    return {
      positions: new Float32Array(0),
      amplitudes: new Float32Array(0),
      times: new Float32Array(0),
      maxAmplitude: 0,
      averageAmplitude: 0,
      count: 0,
      sampleRate: audio.sampleRate,
      duration: audio.duration,
      processingTime: getPerformanceNow() - startTime
    };
  }

  onProgress?.(50, 'ピークをソート中');

  // 2. 振幅の降順でソート
  allInitialPeaks.sort((a, b) => b.amplitude - a.amplitude);

  onProgress?.(75, 'ピークを選択中');

  // 3. 空間的フィルタリング（最小距離制約）
  const selectedPeaks: Peak[] = [];
  const occupiedRegions: Array<[number, number]> = [];

  for (const candidate of allInitialPeaks) {
    if (selectedPeaks.length >= count) break;

    const candidateStart = candidate.position - minDistance;
    const candidateEnd = candidate.position + minDistance;

    const hasOverlap = occupiedRegions.some(
      ([start, end]) => !(candidateEnd < start || candidateStart > end)
    );

    if (!hasOverlap) {
      selectedPeaks.push({
        position: candidate.position,
        time: candidate.position / audio.sampleRate,
        amplitude: candidate.amplitude
      });

      occupiedRegions.push([candidateStart, candidateEnd]);
    }
  }

  // 4. 時間順でソート
  selectedPeaks.sort((a, b) => a.position - b.position);

  // 5. Float32Arrayに変換
  const positions = new Float32Array(selectedPeaks.length);
  const amplitudes = new Float32Array(selectedPeaks.length);
  const times = new Float32Array(selectedPeaks.length);

  for (let i = 0; i < selectedPeaks.length; i++) {
    const peak = selectedPeaks[i];
    if (peak) {
      positions[i] = peak.position;
      amplitudes[i] = peak.amplitude;
      times[i] = peak.time;
    }
  }

  // 6. 統計情報の計算
  const maxAmplitude = allInitialPeaks.length > 0 ? (allInitialPeaks[0]?.amplitude ?? 0) : 0;
  const averageAmplitude =
    allInitialPeaks.length > 0
      ? allInitialPeaks.reduce((sum, p) => sum + p.amplitude, 0) / allInitialPeaks.length
      : 0;

  const processingTime = getPerformanceNow() - startTime;

  onProgress?.(100, '処理完了');

  return {
    positions,
    amplitudes,
    times,
    maxAmplitude,
    averageAmplitude,
    count: selectedPeaks.length,
    sampleRate: audio.sampleRate,
    duration: audio.duration,
    processingTime
  };
}

/**
 * 新しいRMS解析（統一されたインターフェース）
 */
export function getRMSAnalysis(
  audio: AudioData,
  options: RMSAnalysisOptions = {}
): RMSAnalysisResult {
  const startTime = getPerformanceNow();
  const { channel = 0, asDB = false, reference = 1.0, onProgress } = options;
  const reportChannel = typeof channel === 'number' ? channel : -1;

  onProgress?.(0, 'RMS解析を開始');

  const channelData = getChannelData(audio, channel);

  if (channelData.length === 0) {
    const value = asDB ? -Infinity : 0;
    return {
      value,
      channel: reportChannel,
      sampleRate: audio.sampleRate,
      duration: audio.duration,
      processingTime: getPerformanceNow() - startTime
    };
  }

  onProgress?.(50, 'RMS値を計算中');

  let sumSquares = 0;
  let validSampleCount = 0;
  for (let i = 0; i < channelData.length; i++) {
    const sample = channelData[i] ?? 0;
    if (isValidSample(sample)) {
      const validSample = ensureValidSample(sample);
      sumSquares += validSample * validSample;
      validSampleCount++;
    }
  }

  if (validSampleCount === 0) {
    const value = asDB ? -Infinity : 0;
    const processingTime = getPerformanceNow() - startTime;

    onProgress?.(100, '処理完了');

    if (asDB) {
      return {
        value,
        channel: reportChannel,
        sampleRate: audio.sampleRate,
        duration: audio.duration,
        processingTime
      };
    }

    return {
      value,
      valueDB: -Infinity,
      channel: reportChannel,
      sampleRate: audio.sampleRate,
      duration: audio.duration,
      processingTime
    };
  }

  const rmsValue = Math.sqrt(sumSquares / validSampleCount);
  const processingTime = getPerformanceNow() - startTime;

  onProgress?.(100, '処理完了');

  if (asDB) {
    return {
      value: amplitudeToDecibels(rmsValue, reference),
      channel: reportChannel,
      sampleRate: audio.sampleRate,
      duration: audio.duration,
      processingTime
    };
  } else {
    return {
      value: rmsValue,
      valueDB: amplitudeToDecibels(rmsValue, reference),
      channel: reportChannel,
      sampleRate: audio.sampleRate,
      duration: audio.duration,
      processingTime
    };
  }
}
