import { AudioData, AudioInspectError } from '../types.js';

/**
 * チャンネルデータを安全に取得する共通関数
 * @param audio - AudioData オブジェクト
 * @param channel - チャンネル番号 (-1 で全チャンネルの平均)
 * @returns 指定されたチャンネルのデータ
 * @throws AudioInspectError チャンネルが無効な場合
 */
export function getChannelData(audio: AudioData, channel: number): Float32Array {
  if (channel === -1) {
    // 全チャンネルの平均を計算
    const averageData = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        const channelData = audio.channelData[ch];
        if (!channelData) {
          throw new AudioInspectError(
            'INVALID_INPUT',
            `チャンネル ${ch} のデータが存在しません`
          );
        }
        if (i < channelData.length) {
          const sample = channelData[i];
          if (sample !== undefined) {
            sum += sample;
          }
        }
      }
      averageData[i] = sum / audio.numberOfChannels;
    }
    return averageData;
  }

  if (channel < 0 || channel >= audio.numberOfChannels) {
    throw new AudioInspectError(
      'INVALID_INPUT',
      `無効なチャンネル番号: ${channel}。有効範囲は 0-${audio.numberOfChannels - 1} または -1（平均）です`
    );
  }

  const channelData = audio.channelData[channel];
  if (!channelData) {
    throw new AudioInspectError(
      'INVALID_INPUT',
      `チャンネル ${channel} のデータが存在しません`
    );
  }

  return channelData;
}

/**
 * 数値が2の冪かどうかを判定
 */
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && Number.isInteger(n) && (n & (n - 1)) === 0;
}

/**
 * 次の2の冪を計算
 */
export function nextPowerOfTwo(n: number): number {
  if (n <= 0) return 1;
  if (isPowerOfTwo(n)) return n;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * 型安全な配列アクセス
 */
export function safeArrayAccess<T>(
  array: ArrayLike<T>,
  index: number,
  defaultValue: T
): T {
  if (index >= 0 && index < array.length) {
    return array[index] ?? defaultValue;
  }
  return defaultValue;
}

/**
 * 数値の妥当性を検証
 */
export function isValidSample(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * サンプル値の安全な取得
 */
export function ensureValidSample(value: number | undefined | null, defaultValue: number = 0): number {
  return isValidSample(value) ? value : defaultValue;
}

/**
 * Float32Arrayの安全な確保
 */
export function ensureFloat32Array(
  data: Float32Array | undefined | null,
  length: number
): Float32Array {
  if (data instanceof Float32Array && data.length === length) {
    return data;
  }
  return new Float32Array(length);
}

/**
 * 振幅をdBに変換
 */
export function amplitudeToDecibels(amplitude: number, reference: number = 1.0): number {
  const MIN_AMPLITUDE_FOR_DB = 1e-10; // -200 dBFS
  const SILENCE_DB = -Infinity;
  
  if (amplitude <= 0 || reference <= 0) {
    return SILENCE_DB;
  }
  
  const ratio = amplitude / reference;
  return ratio > MIN_AMPLITUDE_FOR_DB 
    ? 20 * Math.log10(ratio) 
    : SILENCE_DB;
}

/**
 * dBを振幅に変換
 */
export function decibelsToAmplitude(db: number, reference: number = 1.0): number {
  if (!isFinite(db)) return 0;
  return reference * Math.pow(10, db / 20);
} 