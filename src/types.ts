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
export type Feature<T> = (audio: AudioData, options?: any) => T | Promise<T>;

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
  | 'PROCESSING_ERROR';

/**
 * audio-inspect固有のエラー
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