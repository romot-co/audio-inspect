/**
 * audio-inspect ライブラリの型定義
 */

import type { FFTProviderType } from './core/fft-provider.js';

/**
 * 音声ソースの型定義
 */
export type AudioSource =
  | ArrayBuffer
  | Blob
  | File
  | URL
  | string // URLパス
  | MediaStream
  | AudioBuffer
  | AudioData;

/**
 * 音声データの構造
 */
export interface AudioData {
  /** サンプルレート（Hz） */
  sampleRate: number;
  /** チャンネルごとのオーディオデータ */
  channelData: Float32Array[];
  /** 音声の長さ（秒） */
  duration: number;
  /** チャンネル数 */
  numberOfChannels: number;
  /** サンプル数 */
  length: number;
}

/**
 * 特徴抽出関数の型
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Feature<T> = (audio: AudioData, ...args: any[]) => T | Promise<T>;

/**
 * ロード時のオプション
 */
export interface LoadOptions {
  /** リサンプリング対象のサンプルレート */
  sampleRate?: number;
  /** チャンネル数の指定 */
  channels?: number | 'mono';
  /** 正規化するか */
  normalize?: boolean;
  /** 遅延読み込み（大きなファイル用） */
  lazy?: boolean;
  /** チャンクサイズ（ストリーミング時） */
  chunkSize?: number;
}

/**
 * ストリーミング制御インターフェース
 */
export interface StreamController {
  pause(): void;
  resume(): void;
  stop(): void;
  readonly paused: boolean;
}

/**
 * ストリーミングオプション
 */
export interface StreamOptions {
  /** バッファサイズ */
  bufferSize?: number;
  /** ホップサイズ */
  hopSize?: number;
  /** 更新頻度の制限（ミリ秒） */
  throttle?: number;
  /** 窓関数の種類 */
  windowFunction?: WindowFunction;
  /** AudioInspectProcessorのモジュールURL（フル機能版を使用する場合） */
  processorModuleUrl?: string;
}

/**
 * フォールバック機能付きストリーミングオプション
 */
export interface StreamOptionsWithFallback extends StreamOptions {
  /** フォールバック処理を有効にするか */
  enableFallback?: boolean;
  /** フォールバック時のハンドラー */
  fallbackHandler?: (audio: AudioData) => void;
}

/**
 * 窓関数の種類
 */
export type WindowFunction = 'hann' | 'hamming' | 'blackman' | 'rectangular';

/**
 * 振幅測定のオプション
 */
export interface AmplitudeOptions {
  channel?: number;
  asDB?: boolean;
  reference?: number; // dB計算の基準値（デフォルト: 1.0 = 0 dBFS）
}

/**
 * 共通の解析オプション
 */
export interface CommonAnalysisOptions {
  channel?: number;
}

/**
 * 時間窓パラメータ
 */
export interface TimeWindowOptions {
  windowSizeMs?: number;
  hopSizeMs?: number;
}

/**
 * 周波数範囲パラメータ
 */
export interface FrequencyRangeOptions {
  minFrequency?: number;
  maxFrequency?: number;
}

/**
 * Nullable型の明示的な定義
 */
export type NullableNumber = number | null;
export type NullableFloat32Array = Float32Array | null;

/**
 * 結果型（エラー処理用）
 */
export type Result<T, E = AudioInspectError> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * エラーコード
 */
export type ErrorCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_FORMAT'
  | 'DECODE_ERROR'
  | 'NETWORK_ERROR'
  | 'FFT_PROVIDER_ERROR'
  | 'PROCESSING_ERROR'
  | 'INITIALIZATION_FAILED'
  | 'WORKLET_NOT_SUPPORTED' // AudioWorkletサポートなし
  | 'MODULE_LOAD_FAILED'; // モジュール読み込み失敗

/**
 * Audio-inspect specific error
 */
export class AudioInspectError extends Error {
  public override readonly name = 'AudioInspectError';

  constructor(
    public readonly code: ErrorCode,
    message: string,
    public override readonly cause?: unknown
  ) {
    super(message);
  }
}

/**
 * audio-inspect固有のエラーかチェック
 */
export function isAudioInspectError(error: unknown): error is AudioInspectError {
  return error instanceof AudioInspectError;
}

/**
 * AudioInspectNodeのオプション
 */
export interface AudioInspectNodeOptions {
  /** 使用する解析機能名 */
  featureName: string;
  /** 解析機能に渡すオプション */
  featureOptions?: unknown;
  /** 解析を実行するための内部バッファサイズ（サンプル数） */
  bufferSize?: number;
  /** 次の解析を開始するまでのオフセット（サンプル数） */
  hopSize?: number;
  /** 入力として期待するチャンネル数 */
  inputChannelCount?: number;
  /** 使用するFFTプロバイダー */
  provider?: FFTProviderType;
}

/**
 * AudioWorkletプロセッサーの初期化オプション
 */
export interface AudioInspectProcessorOptions {
  featureName: string;
  featureOptions?: unknown;
  bufferSize: number;
  hopSize: number;
  inputChannelCount: number;
  provider?: FFTProviderType;
}

/**
 * AudioWorklet共通メッセージ型（型安全性向上）
 */
export type AudioWorkletMessage =
  | AnalysisResultMessage
  | ErrorMessage
  | UpdateOptionsMessage
  | ResetMessage
  | CleanupMessage;

/**
 * 解析結果メッセージ
 */
export interface AnalysisResultMessage {
  type: 'analysisResult';
  data: unknown;
  timestamp: number;
}

/**
 * Error message
 */
export interface ErrorMessage {
  type: 'error';
  message: string;
  detail?: unknown;
}

/**
 * オプション更新メッセージ
 */
export interface UpdateOptionsMessage {
  type: 'updateOptions';
  payload: Partial<AudioInspectProcessorOptions>;
}

/**
 * リセットメッセージ
 */
export interface ResetMessage {
  type: 'reset';
}

/**
 * クリーンアップメッセージ
 */
export interface CleanupMessage {
  type: 'cleanup';
}

/**
 * AudioInspectNodeのイベントハンドラー
 */
export interface AudioInspectNodeEventHandlers {
  onresult?: (event: { data: unknown; timestamp: number }) => void;
  onerror?: (event: { message: string; detail?: unknown }) => void;
}

// Buffer overflow warning message (newly added)
export interface BufferOverflowMessage {
  type: 'bufferOverflow';
  details: {
    bufferWritePosition: number;
    bufferSize: number;
    timestamp: number;
  };
}
