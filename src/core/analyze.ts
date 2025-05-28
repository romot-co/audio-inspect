import { AudioData, Feature, AudioInspectError } from '../types.js';

/**
 * 音声データから特徴量を抽出する
 */
export async function analyze<T>(audio: AudioData, feature: Feature<T>): Promise<T> {
  try {
    // 入力検証
    validateAudioData(audio);
    
    // 特徴抽出関数を実行
    const result = await feature(audio);
    
    return result;
  } catch (error) {
    throw new AudioInspectError(
      'FFT_PROVIDER_ERROR',
      `特徴量の抽出に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * AudioDataの入力検証
 */
function validateAudioData(audio: AudioData): void {
  if (!audio || typeof audio !== 'object') {
    throw new AudioInspectError('INVALID_INPUT', 'AudioDataが無効です');
  }

  if (typeof audio.sampleRate !== 'number' || audio.sampleRate <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'サンプルレートが無効です');
  }

  if (!Array.isArray(audio.channelData) || audio.channelData.length === 0) {
    throw new AudioInspectError('INVALID_INPUT', 'チャンネルデータが無効です');
  }

  if (typeof audio.numberOfChannels !== 'number' || audio.numberOfChannels !== audio.channelData.length) {
    throw new AudioInspectError('INVALID_INPUT', 'チャンネル数が一致しません');
  }

  if (typeof audio.length !== 'number' || audio.length <= 0) {
    throw new AudioInspectError('INVALID_INPUT', 'データ長が無効です');
  }

  if (typeof audio.duration !== 'number' || audio.duration <= 0) {
    throw new AudioInspectError('INVALID_INPUT', '音声の長さが無効です');
  }

  // 各チャンネルのデータ長が一致することを確認
  const expectedLength = audio.channelData[0]!.length;
  for (let i = 0; i < audio.channelData.length; i++) {
    const channelData = audio.channelData[i];
    if (!(channelData instanceof Float32Array)) {
      throw new AudioInspectError('INVALID_INPUT', `チャンネル ${i} のデータが Float32Array ではありません`);
    }
    if (channelData.length !== expectedLength) {
      throw new AudioInspectError('INVALID_INPUT', `チャンネル ${i} のデータ長が一致しません`);
    }
  }
} 