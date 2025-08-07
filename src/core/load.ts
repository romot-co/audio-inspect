import { AudioSource, AudioData, LoadOptions, AudioInspectError } from '../types.js';

/**
 * 音声データを読み込み、解析可能な形式に変換する
 */
export async function load(source: AudioSource, options: LoadOptions = {}): Promise<AudioData> {
  try {
    // 既にAudioDataの場合はそのまま返す
    if (isAudioData(source)) {
      return await processAudioData(source, options);
    }

    // Web Audio APIのコンテキストを取得または作成
    const audioContext = getAudioContext();

    // ソースの種類に応じて処理を分岐
    const audioBuffer = await decodeAudioSource(source, audioContext);

    // AudioBufferからAudioDataに変換
    const audioData = audioBufferToAudioData(audioBuffer);

    // オプションに基づいて後処理
    return await processAudioData(audioData, options);
  } catch (error) {
    throw new AudioInspectError(
      'DECODE_ERROR',
      `音声データの読み込みに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    );
  }
}

/**
 * AudioDataかどうかチェック
 */
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

// シングルトンAudioContext管理
let sharedAudioContext: AudioContext | null = null;

/**
 * AudioContextを取得または作成（シングルトンパターン）
 */
function getAudioContext(): AudioContext {
  // ブラウザ環境でのみAudioContextを使用
  if (typeof AudioContext !== 'undefined') {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioContext();
    }
    return sharedAudioContext;
  }
  // Node.js環境では別の処理が必要（将来的に実装）
  throw new AudioInspectError('UNSUPPORTED_FORMAT', 'この環境ではWeb Audio APIが利用できません');
}

/**
 * ソースの種類に応じてAudioBufferにデコード
 */
async function decodeAudioSource(
  source: AudioSource,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  try {
    if (source instanceof AudioBuffer) {
      return source;
    }

    if (source instanceof ArrayBuffer) {
      return await audioContext.decodeAudioData(source);
    }

    if (source instanceof Blob || source instanceof File) {
      const arrayBuffer = await source.arrayBuffer();
      return await audioContext.decodeAudioData(arrayBuffer);
    }

    if (typeof source === 'string' || source instanceof URL) {
      const url = source instanceof URL ? source.href : source;
      const response = await fetch(url);

      if (!response.ok) {
        throw new AudioInspectError(
          'NETWORK_ERROR',
          `音声ファイルの取得に失敗しました: ${response.status}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return await audioContext.decodeAudioData(arrayBuffer);
    }

    if (source instanceof MediaStream) {
      // MediaStreamの処理は複雑なので、将来的に実装
      throw new AudioInspectError(
        'UNSUPPORTED_FORMAT',
        'MediaStreamの処理は現在サポートされていません'
      );
    }

    throw new AudioInspectError('INVALID_INPUT', 'サポートされていない音声ソースです');
  } finally {
    // デコード完了後、不要になったコンテキストをクリーンアップ
    // ただし、他の処理で使用中の可能性があるため、即座にはクローズしない
    // 将来的にはリファレンスカウンティングを実装する可能性あり
  }
}

/**
 * AudioBufferからAudioDataに変換
 */
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

/**
 * オプションに基づいてAudioDataを後処理
 */
async function processAudioData(audioData: AudioData, options: LoadOptions): Promise<AudioData> {
  let result = audioData;

  // チャンネル変換
  if (options.channels === 'mono' || options.channels === 1) {
    result = convertToMono(result);
  } else if (options.channels === 'stereo' || options.channels === 2) {
    result = ensureStereo(result);
  }

  // 正規化
  if (options.normalize) {
    result = normalize(result);
  }

  // 修正2.4: サンプルレート変換の実装
  if (options.sampleRate && options.sampleRate !== result.sampleRate) {
    try {
      result = await resampleAudioData(result, options.sampleRate);
    } catch (error) {
      console.warn('サンプルレート変換に失敗しました:', error);
      throw new AudioInspectError(
        'PROCESSING_ERROR',
        `サンプルレート変換に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return result;
}

/**
 * AudioDataをリサンプリング
 */
async function resampleAudioData(
  audioData: AudioData,
  targetSampleRate: number
): Promise<AudioData> {
  // OfflineAudioContextが利用できない環境での対応
  if (typeof OfflineAudioContext === 'undefined') {
    throw new AudioInspectError(
      'UNSUPPORTED_FORMAT',
      'この環境ではサンプルレート変換がサポートされていません'
    );
  }

  const originalSampleRate = audioData.sampleRate;
  const originalLength = audioData.length;
  const targetLength = Math.floor((originalLength * targetSampleRate) / originalSampleRate);

  // OfflineAudioContextを作成
  const offlineContext = new OfflineAudioContext(
    audioData.numberOfChannels,
    targetLength,
    targetSampleRate
  );

  // 元のAudioDataからAudioBufferを作成
  const originalBuffer = offlineContext.createBuffer(
    audioData.numberOfChannels,
    originalLength,
    originalSampleRate
  );

  // チャンネルデータをコピー
  for (let channel = 0; channel < audioData.numberOfChannels; channel++) {
    const channelData = audioData.channelData[channel];
    if (channelData) {
      originalBuffer.copyToChannel(channelData, channel);
    }
  }

  // AudioBufferSourceNodeを作成してリサンプリング
  const source = offlineContext.createBufferSource();
  source.buffer = originalBuffer;
  source.connect(offlineContext.destination);

  // レンダリング開始
  source.start(0);
  const resampledBuffer = await offlineContext.startRendering();

  // リサンプリングされたAudioBufferからAudioDataに変換
  return audioBufferToAudioData(resampledBuffer);
}

/**
 * モノラルに変換
 */
function convertToMono(audioData: AudioData): AudioData {
  if (audioData.numberOfChannels === 1) {
    return audioData;
  }

  const monoData = new Float32Array(audioData.length);

  // 全チャンネルの平均を取る
  for (let i = 0; i < audioData.length; i++) {
    let sum = 0;
    for (let channel = 0; channel < audioData.numberOfChannels; channel++) {
      const channelData = audioData.channelData[channel];
      const sample = channelData?.[i];
      if (channelData && sample !== undefined) {
        sum += sample;
      }
    }
    monoData[i] = sum / audioData.numberOfChannels;
  }

  return {
    sampleRate: audioData.sampleRate,
    channelData: [monoData],
    duration: audioData.duration,
    numberOfChannels: 1,
    length: audioData.length
  };
}

/**
 * ステレオに変換（モノラルの場合は複製、既にステレオの場合はそのまま）
 */
function ensureStereo(audioData: AudioData): AudioData {
  if (audioData.numberOfChannels === 2) {
    return audioData;
  }

  if (audioData.numberOfChannels === 1) {
    // モノラルをステレオに変換（左右同じ音声）
    const monoData = audioData.channelData[0];
    if (!monoData) {
      throw new AudioInspectError('INVALID_INPUT', 'チャンネル0のデータが存在しません');
    }
    const stereoChannelData = [
      new Float32Array(monoData),
      new Float32Array(monoData)
    ];

    return {
      sampleRate: audioData.sampleRate,
      channelData: stereoChannelData,
      duration: audioData.duration,
      numberOfChannels: 2,
      length: audioData.length
    };
  }

  // 3チャンネル以上の場合は最初の2チャンネルを使用
  const firstChannel = audioData.channelData[0];
  if (!firstChannel) {
    throw new AudioInspectError('INVALID_INPUT', 'チャンネル0のデータが存在しません');
  }
  const stereoChannelData = [
    firstChannel,
    audioData.channelData[1] || firstChannel // 2チャンネル目がない場合は1チャンネル目を複製
  ];

  return {
    sampleRate: audioData.sampleRate,
    channelData: stereoChannelData,
    duration: audioData.duration,
    numberOfChannels: 2,
    length: audioData.length
  };
}

/**
 * 正規化（最大値を1.0にする）
 */
function normalize(audioData: AudioData): AudioData {
  // 最大振幅を見つける
  let maxAmplitude = 0;
  for (const channelData of audioData.channelData) {
    for (const sample of channelData) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
    }
  }

  if (maxAmplitude === 0) {
    return audioData; // 無音の場合はそのまま
  }

  // 正規化
  const normalizedChannels = audioData.channelData.map((channelData) => {
    const normalized = new Float32Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const sample = channelData[i];
      normalized[i] = sample !== undefined ? sample / maxAmplitude : 0;
    }
    return normalized;
  });

  return {
    ...audioData,
    channelData: normalizedChannels
  };
}
