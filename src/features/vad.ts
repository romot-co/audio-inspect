import { AudioData, type ChannelSelector } from '../types.js';
import { getChannelData, ensureValidSample } from '../core/utils.js';

export interface VADOptions {
  channel?: ChannelSelector;
  frameSizeMs?: number;
  hopSizeMs?: number;
  method?: 'energy' | 'zcr' | 'combined' | 'adaptive';

  // 閾値パラメータ
  energyThreshold?: number; // 固定エネルギー閾値
  zcrThresholdLow?: number; // ZCR下限（有声音）
  zcrThresholdHigh?: number; // ZCR上限（無声音）

  // 適応的閾値用パラメータ
  adaptiveAlpha?: number; // 適応率 (0-1)
  noiseFactor?: number; // ノイズレベルに対する倍率

  // 時間制約
  minSilenceDurationMs?: number;
  minSpeechDurationMs?: number;

  // 追加オプション
  preEmphasis?: boolean; // プリエンファシスフィルタ
  smoothing?: boolean; // 判定結果の平滑化
}

export interface VADSegment {
  start: number;
  end: number;
  type: 'speech' | 'silence';
  confidence?: number; // 判定の信頼度 (0-1)
}

export interface VADResult {
  segments: VADSegment[];
  speechRatio: number;
  features?: {
    energies: Float32Array;
    zcrs: Float32Array;
    decisions: Float32Array; // 0-1の連続値
    times: Float32Array;
  };
}

/**
 * プリエンファシスフィルタ
 */
function applyPreEmphasis(data: Float32Array, alpha: number = 0.97): Float32Array {
  const filtered = new Float32Array(data.length);
  filtered[0] = data[0] || 0;

  for (let i = 1; i < data.length; i++) {
    const current = ensureValidSample(data[i] ?? 0);
    const previous = ensureValidSample(data[i - 1] ?? 0);
    filtered[i] = current - alpha * previous;
  }

  return filtered;
}

/**
 * フレームエネルギー計算
 */
function calculateFrameEnergies(
  channelData: Float32Array,
  frameSizeSamples: number,
  hopSizeSamples: number,
  sampleRate: number,
  useLogEnergy: boolean = false
): { energies: Float32Array; times: Float32Array } {
  const dataLength = channelData.length;

  if (dataLength < frameSizeSamples) {
    return { energies: new Float32Array(0), times: new Float32Array(0) };
  }

  const frameCount = Math.floor((dataLength - frameSizeSamples) / hopSizeSamples) + 1;
  const energies = new Float32Array(frameCount);
  const times = new Float32Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    const start = i * hopSizeSamples;
    const end = Math.min(start + frameSizeSamples, dataLength);

    let energy = 0;
    let validSamples = 0;

    for (let j = start; j < end; j++) {
      const sample = ensureValidSample(channelData[j] ?? 0);
      energy += sample * sample;
      validSamples++;
    }

    energy = validSamples > 0 ? energy / validSamples : 0; // 正規化

    if (useLogEnergy) {
      energies[i] = energy > 1e-10 ? 10 * Math.log10(energy) : -100;
    } else {
      energies[i] = energy;
    }

    times[i] = (start + frameSizeSamples / 2) / sampleRate;
  }

  return { energies, times };
}

/**
 * フレームZCR計算
 */
function calculateFrameZCRs(
  channelData: Float32Array,
  frameSizeSamples: number,
  hopSizeSamples: number,
  normalize: boolean = true
): Float32Array {
  const dataLength = channelData.length;

  if (dataLength < frameSizeSamples) {
    return new Float32Array(0);
  }

  const frameCount = Math.floor((dataLength - frameSizeSamples) / hopSizeSamples) + 1;
  const zcrs = new Float32Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    const start = i * hopSizeSamples;
    const end = Math.min(start + frameSizeSamples, dataLength);

    let crossings = 0;
    let prevSign = Math.sign(ensureValidSample(channelData[start] ?? 0));

    for (let j = start + 1; j < end; j++) {
      const sample = ensureValidSample(channelData[j] ?? 0);
      const currentSign = Math.sign(sample);
      if (prevSign !== currentSign && prevSign !== 0 && currentSign !== 0) {
        crossings++;
      }
      prevSign = currentSign;
    }

    zcrs[i] = normalize ? crossings / Math.max(1, end - start - 1) : crossings;
  }

  return zcrs;
}

/**
 * 適応的閾値の計算
 */
function calculateAdaptiveThreshold(
  values: Float32Array,
  alpha: number,
  noiseFactor: number,
  initialFrames: number = 10
): Float32Array {
  const thresholds = new Float32Array(values.length);

  // 初期ノイズレベルの推定（最初のフレームから）
  let noiseLevel = 0;
  const noiseFrames = Math.min(initialFrames, values.length);

  for (let i = 0; i < noiseFrames; i++) {
    const value = values[i] ?? 0;
    if (value !== undefined) {
      noiseLevel += value;
    }
  }
  noiseLevel = noiseFrames > 0 ? noiseLevel / noiseFrames : 0;

  // 適応的閾値の計算
  for (let i = 0; i < values.length; i++) {
    const value = values[i] ?? 0;
    if (value === undefined) {
      thresholds[i] =
        i > 0 ? (thresholds[i - 1] ?? noiseLevel * noiseFactor) : noiseLevel * noiseFactor;
      continue;
    }

    if (i === 0) {
      thresholds[i] = noiseLevel * noiseFactor;
    } else {
      const prevThreshold = thresholds[i - 1];
      // 指数移動平均によるノイズレベルの更新
      if (prevThreshold !== undefined && value < prevThreshold) {
        noiseLevel = alpha * noiseLevel + (1 - alpha) * value;
      }
      thresholds[i] = noiseLevel * noiseFactor;
    }
  }

  return thresholds;
}

/**
 * 判定結果の平滑化（メディアンフィルタ）
 */
function smoothDecisions(decisions: Float32Array, windowSize: number = 5): Float32Array {
  const smoothed = new Float32Array(decisions.length);
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < decisions.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(decisions.length, i + halfWindow + 1);

    // 窓内の値を収集してソート
    const windowValues: number[] = [];
    for (let j = start; j < end; j++) {
      const value = decisions[j] ?? 0;
      if (value !== undefined) {
        windowValues.push(value);
      }
    }
    windowValues.sort((a, b) => a - b);

    // メディアン値を取得
    if (windowValues.length > 0) {
      const medianIdx = Math.floor(windowValues.length / 2);
      const medianValue = windowValues[medianIdx];
      smoothed[i] = medianValue ?? 0;
    } else {
      smoothed[i] = 0;
    }
  }

  return smoothed;
}

/**
 * セグメント化（連続値から）
 */
function createSegmentsFromContinuous(
  decisions: Float32Array,
  times: Float32Array,
  threshold: number = 0.5,
  minSpeechSec: number = 0.1,
  minSilenceSec: number = 0.3
): VADSegment[] {
  const segments: VADSegment[] = [];
  let currentSegment: VADSegment | null = null;

  for (let i = 0; i < decisions.length; i++) {
    const decision = decisions[i] ?? 0;
    const time = times[i] ?? 0;
    if (decision === undefined || time === undefined) continue;

    const isSpeech = decision >= threshold;

    if (!currentSegment) {
      currentSegment = {
        start: time,
        end: time,
        type: isSpeech ? 'speech' : 'silence',
        confidence: Math.abs(decision - 0.5) * 2
      };
    } else if (
      (isSpeech && currentSegment.type === 'speech') ||
      (!isSpeech && currentSegment.type === 'silence')
    ) {
      // 同じタイプのセグメントを延長
      currentSegment.end = time;
      const conf = Math.abs(decision - 0.5) * 2;
      currentSegment.confidence = Math.max(currentSegment.confidence || 0, conf);
    } else {
      // タイプが変わった場合
      segments.push(currentSegment);
      currentSegment = {
        start: time,
        end: time,
        type: isSpeech ? 'speech' : 'silence',
        confidence: Math.abs(decision - 0.5) * 2
      };
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  // 短いセグメントのフィルタリング
  return filterShortSegments(segments, minSpeechSec, minSilenceSec);
}

/**
 * 短いセグメントのフィルタリング
 */
function filterShortSegments(
  segments: VADSegment[],
  minSpeechSec: number,
  minSilenceSec: number
): VADSegment[] {
  if (segments.length === 0) return [];

  const filtered: VADSegment[] = [];
  let i = 0;

  while (i < segments.length) {
    const current = segments[i];
    if (!current) {
      i++;
      continue;
    }

    const duration = current.end - current.start;

    if (
      (current.type === 'speech' && duration >= minSpeechSec) ||
      (current.type === 'silence' && duration >= minSilenceSec)
    ) {
      // セグメントを保持
      filtered.push(current);
      i++;
    } else {
      // 短いセグメントの処理
      if (filtered.length > 0 && i + 1 < segments.length) {
        const prev = filtered[filtered.length - 1];
        const next = segments[i + 1];

        if (prev && next && prev.type === next.type) {
          // 前後が同じタイプなら統合
          prev.end = next.end;
          i += 2; // 現在と次のセグメントをスキップ
          continue;
        }
      }

      // 統合できない場合はタイプを変更
      if (filtered.length > 0) {
        const lastFiltered = filtered[filtered.length - 1];
        if (lastFiltered) {
          lastFiltered.end = current.end;
        }
      }
      i++;
    }
  }

  return filtered;
}

/**
 * VAD（音声区間検出）を実行
 */
export function getVAD(audio: AudioData, options: VADOptions = {}): VADResult {
  const {
    channel = 0,
    frameSizeMs = 30, // 30msフレーム
    hopSizeMs = 10, // 10msホップ
    method = 'combined',
    energyThreshold = 0.02,
    zcrThresholdLow = 0.05,
    zcrThresholdHigh = 0.15,
    adaptiveAlpha = 0.99,
    noiseFactor = 3.0,
    minSilenceDurationMs = 300,
    minSpeechDurationMs = 100,
    preEmphasis = true,
    smoothing = true
  } = options;

  let channelData = getChannelData(audio, channel);

  // プリエンファシス（オプション）
  if (preEmphasis) {
    channelData = applyPreEmphasis(channelData);
  }

  const sr = audio.sampleRate;
  const frameSizeSamples = Math.floor((frameSizeMs / 1000) * sr);
  const hopSizeSamples = Math.floor((hopSizeMs / 1000) * sr);

  if (frameSizeSamples === 0 || hopSizeSamples === 0) {
    return { segments: [], speechRatio: 0 };
  }

  // 特徴量の計算
  const { energies, times } = calculateFrameEnergies(
    channelData,
    frameSizeSamples,
    hopSizeSamples,
    sr,
    false
  );

  const zcrs = calculateFrameZCRs(channelData, frameSizeSamples, hopSizeSamples, true);

  if (energies.length === 0) {
    return { segments: [], speechRatio: 0 };
  }

  // VAD判定
  const decisions = new Float32Array(energies.length);

  switch (method) {
    case 'energy': {
      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i] ?? 0;
        decisions[i] = energy > energyThreshold ? 1 : 0;
      }
      break;
    }

    case 'zcr': {
      for (let i = 0; i < zcrs.length; i++) {
        const zcr = zcrs[i] ?? 0;
        decisions[i] = zcr > zcrThresholdLow && zcr < zcrThresholdHigh ? 1 : 0;
      }
      break;
    }

    case 'combined': {
      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i] ?? 0;
        const zcr = zcrs[i] ?? 0;

        const energyScore = energy > energyThreshold ? 1 : 0;
        const zcrScore = zcr > zcrThresholdLow && zcr < zcrThresholdHigh ? 1 : 0;
        decisions[i] = (energyScore + zcrScore) / 2;
      }
      break;
    }

    case 'adaptive': {
      // 適応的閾値の計算
      const adaptiveThreshold = calculateAdaptiveThreshold(energies, adaptiveAlpha, noiseFactor);

      for (let i = 0; i < energies.length; i++) {
        const energy = energies[i] ?? 0;
        const zcr = zcrs[i] ?? 0;
        const threshold = adaptiveThreshold[i] ?? 0;

        const energyScore = energy > threshold ? 1 : 0;
        const zcrScore = zcr > zcrThresholdLow && zcr < zcrThresholdHigh ? 0.5 : 0;
        decisions[i] = Math.min(1, energyScore + zcrScore);
      }
      break;
    }
  }

  // 平滑化（オプション）
  const finalDecisions = smoothing ? smoothDecisions(decisions, 5) : decisions;

  // セグメント化
  const minSpeechSec = minSpeechDurationMs / 1000;
  const minSilenceSec = minSilenceDurationMs / 1000;

  const segments = createSegmentsFromContinuous(
    finalDecisions,
    times,
    0.5,
    minSpeechSec,
    minSilenceSec
  );

  // 音声区間の割合計算
  let totalSpeechDuration = 0;
  for (const seg of segments) {
    if (seg.type === 'speech') {
      totalSpeechDuration += seg.end - seg.start;
    }
  }

  const speechRatio = audio.duration > 0 ? Math.min(1, totalSpeechDuration / audio.duration) : 0;

  return {
    segments,
    speechRatio,
    features: {
      energies,
      zcrs,
      decisions: finalDecisions,
      times
    }
  };
}
