import { AudioData } from '../types.js';

/**
 * ピーク検出のオプション
 */
export interface PeaksOptions {
  /** 抽出するピークの数（デフォルト: 100） */
  count?: number;
  /** ピーク検出の閾値（0-1、デフォルト: 0.1） */
  threshold?: number;
  /** 解析するチャンネル（デフォルト: 0、-1で全チャンネルの平均） */
  channel?: number;
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

/**
 * ピーク検出を行う
 */
export function getPeaks(audio: AudioData, options: PeaksOptions = {}): PeaksResult {
  const {
    count = 100,
    threshold = 0.1,
    channel = 0,
    minDistance = Math.floor(audio.sampleRate / 100)
  } = options;

  // 解析対象のチャンネルデータを取得
  const channelData = getChannelData(audio, channel);

  // ピーク候補を検出
  const peakCandidates = findPeakCandidates(channelData, threshold, minDistance);

  // 振幅でソートして上位を選択
  const sortedPeaks = peakCandidates.sort((a, b) => b.amplitude - a.amplitude).slice(0, count);

  // 時間順にソート
  sortedPeaks.sort((a, b) => a.position - b.position);

  // 統計情報を計算
  const maxAmplitude =
    peakCandidates.length > 0 ? Math.max(...peakCandidates.map((p) => p.amplitude)) : 0;

  const averageAmplitude =
    peakCandidates.length > 0
      ? peakCandidates.reduce((sum, p) => sum + p.amplitude, 0) / peakCandidates.length
      : 0;

  return {
    peaks: sortedPeaks.map((candidate) => ({
      position: candidate.position,
      time: candidate.position / audio.sampleRate,
      amplitude: candidate.amplitude
    })),
    maxAmplitude,
    averageAmplitude
  };
}

/**
 * 指定されたチャンネルのデータを取得
 */
function getChannelData(audio: AudioData, channel: number): Float32Array {
  if (channel === -1) {
    // 全チャンネルの平均を計算
    const averageData = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        const channelData = audio.channelData[ch];
        if (channelData && i < channelData.length) {
          sum += channelData[i] as number;
        }
      }
      averageData[i] = sum / audio.numberOfChannels;
    }
    return averageData;
  }

  if (channel < 0 || channel >= audio.numberOfChannels) {
    throw new Error(`無効なチャンネル番号: ${channel}`);
  }

  const channelData = audio.channelData[channel];
  if (!channelData) {
    throw new Error(`チャンネル ${channel} のデータが存在しません`);
  }

  return channelData;
}

/**
 * ピーク候補を検出
 */
function findPeakCandidates(data: Float32Array, threshold: number, minDistance: number): Peak[] {
  const peaks: Peak[] = [];
  const length = data.length;

  for (let i = 1; i < length - 1; i++) {
    // 境界チェック済みなので安全にアクセス
    const current = Math.abs(data[i] as number);
    const prev = Math.abs(data[i - 1] as number);
    const next = Math.abs(data[i + 1] as number);

    // ローカルマキシマかつ閾値を超えているかチェック
    if (current > prev && current > next && current > threshold) {
      // 既存のピークとの最小距離をチェック
      let shouldAdd = true;
      let replaceIndex = -1;

      for (let j = 0; j < peaks.length; j++) {
        const peak = peaks[j] as Peak; // 配列内の要素なので存在保証
        const distance = Math.abs(peak.position - i);
        if (distance < minDistance) {
          // 既存のピークと近すぎる
          if (current > peak.amplitude) {
            // より大きい振幅なので既存ピークを置き換え
            replaceIndex = j;
          }
          shouldAdd = false;
          break;
        }
      }

      if (replaceIndex >= 0) {
        // 既存ピークを置き換え
        peaks[replaceIndex] = {
          position: i,
          time: 0,
          amplitude: current
        };
      } else if (shouldAdd) {
        // 新しいピークを追加
        peaks.push({
          position: i,
          time: 0,
          amplitude: current
        });
      }
    }
  }

  return peaks;
}

/**
 * RMS（Root Mean Square）を計算
 */
export function getRMS(audio: AudioData, channel = 0): number {
  const channelData = getChannelData(audio, channel);

  let sum = 0;
  for (let i = 0; i < channelData.length; i++) {
    const sample = channelData[i] as number;
    sum += sample * sample;
  }

  return Math.sqrt(sum / channelData.length);
}

/**
 * ゼロクロッシング率を計算
 */
export function getZeroCrossing(audio: AudioData, channel = 0): number {
  const channelData = getChannelData(audio, channel);

  let crossings = 0;
  for (let i = 1; i < channelData.length; i++) {
    const prev = channelData[i - 1] as number;
    const current = channelData[i] as number;

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
  /** 解析するチャンネル（デフォルト: 0、-1で全チャンネルの平均） */
  channel?: number;
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
  amplitude: number;
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
 *
 * @param audio - 音声データ
 * @param options - 波形データ取得オプション
 * @returns 波形データ
 */
export function getWaveform(audio: AudioData, options: WaveformOptions = {}): WaveformResult {
  const { framesPerSecond = 60, channel = 0, method = 'rms' } = options;

  // チャンネルデータを取得
  const channelData = getChannelData(audio, channel);

  // フレーム計算
  const frameCount = Math.ceil(audio.duration * framesPerSecond);
  const samplesPerFrame = Math.floor(audio.length / frameCount);

  const waveform: WaveformPoint[] = [];
  let maxAmplitude = 0;
  let totalAmplitude = 0;

  for (let i = 0; i < frameCount; i++) {
    const startSample = i * samplesPerFrame;
    const endSample = Math.min(startSample + samplesPerFrame, channelData.length);

    // フレーム内のデータを抽出
    const frameData = channelData.slice(startSample, endSample);

    // 指定された方法で振幅を計算
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
  let sum = 0;
  for (let i = 0; i < frameData.length; i++) {
    const sample = frameData[i] as number;
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
    const sample = Math.abs(frameData[i] as number);
    peak = Math.max(peak, sample);
  }
  return peak;
}

/**
 * フレーム内の平均振幅を計算
 */
function calculateAverageAmplitude(frameData: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frameData.length; i++) {
    sum += Math.abs(frameData[i] as number);
  }
  return frameData.length > 0 ? sum / frameData.length : 0;
}
