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
  channels?: number | 'mono' | 'stereo';
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
 * 窓関数の種類（拡張版）
 */
export type WindowFunction = 'hann' | 'hamming' | 'blackman' | 'rectangular' | 'none';

/**
 * バイカッドフィルタ係数の型定義
 */
export interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a0: number;
  a1: number;
  a2: number;
}

/**
 * 振幅測定のオプション
 */
export interface AmplitudeOptions {
  channel?: number;
  asDB?: boolean;
  reference?: number; // dB計算の基準値（デフォルト: 1.0 = 0 dBFS）
  truePeak?: boolean; // True Peak検出を使用するか
  oversamplingFactor?: number; // オーバーサンプリング倍率（デフォルト: 4）
  interpolation?: 'linear' | 'cubic' | 'sinc'; // 補間方法（デフォルト: 'cubic'）
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
 * プログレス通知オプション
 */
export interface ProgressOptions {
  onProgress?: (percent: number, message?: string) => void;
}

// ==============================================
// 新しい結果型インターフェース（Float32Array対応）
// ==============================================

/**
 * 基本的な解析結果インターフェース
 */
export interface BaseAnalysisResult {
  /** メタデータ */
  sampleRate: number;
  duration: number;
  
  /** 処理情報 */
  processingTime?: number; // ミリ秒
}

/**
 * 新しいWaveform解析結果（Float32Array対応）
 */
export interface WaveformAnalysisResult extends BaseAnalysisResult {
  /** 振幅データ（直接使用可能） */
  amplitudes: Float32Array;
  /** タイムスタンプ（オプショナル） */
  timestamps?: Float32Array;
  
  /** メタデータ */
  frameCount: number;
  samplesPerFrame: number;
  framesPerSecond: number;
  
  /** 統計情報 */
  maxAmplitude: number;
  averageAmplitude: number;
}

/**
 * 新しいPeaks解析結果（Float32Array対応）
 */
export interface PeaksAnalysisResult extends BaseAnalysisResult {
  /** サンプル位置 */
  positions: Float32Array;
  /** ピーク振幅 */
  amplitudes: Float32Array;
  /** 時間（秒） */
  times: Float32Array;
  
  /** 統計情報 */
  maxAmplitude: number;
  averageAmplitude: number;
  count: number;
}

/**
 * 新しいSpectrum解析結果（Float32Array対応）
 */
export interface SpectrumAnalysisResult extends BaseAnalysisResult {
  /** 周波数ビン */
  frequencies: Float32Array;
  /** マグニチュード */
  magnitudes: Float32Array;
  /** 位相（オプショナル） */
  phases?: Float32Array;
  
  /** FFT設定 */
  fftSize: number;
  windowFunction: string;
}

/**
 * 新しいEnergy解析結果（Float32Array対応）
 */
export interface EnergyAnalysisResult extends BaseAnalysisResult {
  /** エネルギー値 */
  energies: Float32Array;
  /** タイムスタンプ */
  times: Float32Array;
  
  /** 統計情報 */
  totalEnergy: number;
  meanEnergy: number;
  maxEnergy: number;
  minEnergy: number;
}

/**
 * 新しいRMS解析結果（統一されたインターフェース）
 */
export interface RMSAnalysisResult extends BaseAnalysisResult {
  /** RMS値 */
  value: number;
  /** デシベル値（オプショナル） */
  valueDB?: number;
  /** 処理したチャンネル */
  channel: number;
}

// ==============================================
// バッチ処理API用の型定義
// ==============================================

/**
 * バッチ解析のオプション
 */
export interface BatchAnalysisOptions {
  waveform?: { framesPerSecond?: number; channel?: number; method?: 'rms' | 'peak' | 'average' };
  peaks?: { count?: number; threshold?: number; channel?: number; minDistance?: number };
  rms?: { channel?: number; asDB?: boolean; reference?: number };
  spectrum?: { fftSize?: number; windowFunction?: WindowFunction; channel?: number };
  energy?: { windowSizeMs?: number; hopSizeMs?: number; channel?: number };
  onProgress?: (percent: number, feature: string) => void;
}

/**
 * バッチ解析の結果
 */
export interface BatchAnalysisResult {
  waveform?: WaveformAnalysisResult;
  peaks?: PeaksAnalysisResult;
  rms?: RMSAnalysisResult;
  spectrum?: SpectrumAnalysisResult;
  energy?: EnergyAnalysisResult;
  processingTime: number;
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
  | 'MODULE_LOAD_FAILED' // モジュール読み込み失敗
  | 'INSUFFICIENT_DATA' // データ不足
  | 'MEMORY_ERROR' // メモリエラー
  | 'CANCELLED'; // 処理キャンセル

/**
 * Audio-inspect specific error（拡張版）
 */
export class AudioInspectError extends Error {
  public override readonly name = 'AudioInspectError';
  public readonly timestamp = new Date();
  public override readonly cause?: unknown;

  constructor(
    public readonly code: ErrorCode,
    message: string,
    cause?: unknown,
    public readonly details?: unknown
  ) {
    super(message, { cause });
    this.cause = cause;
    
    // スタックトレースを保持
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AudioInspectError);
    }
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause
    };
  }
}

/**
 * エラー作成ヘルパー関数
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: unknown
): AudioInspectError {
  return new AudioInspectError(code, message, undefined, details);
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
