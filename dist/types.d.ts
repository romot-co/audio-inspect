/**
 * 音声ソースの型定義
 */
export type AudioSource = ArrayBuffer | Blob | File | URL | string | MediaStream | AudioBuffer | AudioData;
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
export type WindowFunction = 'hanning' | 'hamming' | 'blackman' | 'rectangular';
/**
 * エラーコード
 */
export type ErrorCode = 'INVALID_INPUT' | 'UNSUPPORTED_FORMAT' | 'DECODE_ERROR' | 'NETWORK_ERROR' | 'FFT_PROVIDER_ERROR' | 'PROCESSING_ERROR';
/**
 * audio-inspect固有のエラー
 */
export declare class AudioInspectError extends Error {
    readonly code: ErrorCode;
    readonly cause?: unknown | undefined;
    readonly name = "AudioInspectError";
    constructor(code: ErrorCode, message: string, cause?: unknown | undefined);
}
/**
 * audio-inspect固有のエラーかチェック
 */
export declare function isAudioInspectError(error: unknown): error is AudioInspectError;
