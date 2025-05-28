/**
 * 音声ソースの型定義
 */
type AudioSource = ArrayBuffer | Blob | File | URL | string | MediaStream | AudioBuffer | AudioData;
/**
 * 音声データの構造
 */
interface AudioData {
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
type Feature<T> = (audio: AudioData, options?: any) => T | Promise<T>;
/**
 * ロード時のオプション
 */
interface LoadOptions {
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
interface StreamController {
    pause(): void;
    resume(): void;
    stop(): void;
    readonly paused: boolean;
}
/**
 * ストリーミングオプション
 */
interface StreamOptions {
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
type WindowFunction = 'hanning' | 'hamming' | 'blackman' | 'rectangular';
/**
 * エラーコード
 */
type ErrorCode = 'INVALID_INPUT' | 'UNSUPPORTED_FORMAT' | 'DECODE_ERROR' | 'NETWORK_ERROR' | 'FFT_PROVIDER_ERROR' | 'PROCESSING_ERROR';
/**
 * audio-inspect固有のエラー
 */
declare class AudioInspectError extends Error {
    readonly code: ErrorCode;
    readonly cause?: unknown | undefined;
    readonly name = "AudioInspectError";
    constructor(code: ErrorCode, message: string, cause?: unknown | undefined);
}
/**
 * audio-inspect固有のエラーかチェック
 */
declare function isAudioInspectError(error: unknown): error is AudioInspectError;

/**
 * 音声データを読み込み、解析可能な形式に変換する
 */
declare function load(source: AudioSource, options?: LoadOptions): Promise<AudioData>;

/**
 * 音声データから特徴量を抽出する
 */
declare function analyze<T>(audio: AudioData, feature: Feature<T>): Promise<T>;

declare function stream<T>(_source: AudioSource, _feature: Feature<T>, _options?: StreamOptions): StreamController;

/**
 * FFTプロバイダーの種類
 */
type FFTProviderType = 'webfft' | 'native' | 'custom';
/**
 * FFT結果
 */
interface FFTResult {
    /** 複素数結果（インターリーブ形式：実部、虚部、実部、虚部...） */
    complex: Float32Array;
    /** 振幅スペクトラム */
    magnitude: Float32Array;
    /** 位相スペクトラム */
    phase: Float32Array;
    /** 周波数ビン（Hz） */
    frequencies: Float32Array;
}
/**
 * FFTプロバイダーのインターフェース
 */
interface IFFTProvider {
    /** プロバイダー名 */
    readonly name: string;
    /** FFTサイズ */
    readonly size: number;
    /** サンプルレート */
    readonly sampleRate: number;
    /**
     * FFTを実行
     * @param input - 実数入力データ
     * @returns FFT結果
     */
    fft(input: Float32Array): FFTResult;
    /**
     * リソースを解放
     */
    dispose(): void;
    /**
     * プロファイリングを実行（対応している場合）
     */
    profile?(): Promise<any>;
}
/**
 * FFTプロバイダーの設定
 */
interface FFTProviderConfig {
    /** プロバイダータイプ */
    type: FFTProviderType;
    /** FFTサイズ（2の累乗である必要があります） */
    fftSize: number;
    /** サンプルレート */
    sampleRate: number;
    /** 自動プロファイリングを有効にするか */
    enableProfiling?: boolean;
    /** カスタムプロバイダー（type='custom'の場合） */
    customProvider?: IFFTProvider;
}
/**
 * FFTプロバイダーファクトリー
 */
declare class FFTProviderFactory {
    /**
     * 指定された設定でFFTプロバイダーを作成
     */
    static createProvider(config: FFTProviderConfig): Promise<IFFTProvider>;
    /**
     * 利用可能なプロバイダーをリスト
     */
    static getAvailableProviders(): FFTProviderType[];
}

/**
 * ピーク検出のオプション
 */
interface PeaksOptions {
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
interface Peak {
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
interface PeaksResult {
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
declare function getPeaks(audio: AudioData, options?: PeaksOptions): PeaksResult;
/**
 * RMS（Root Mean Square）を計算
 */
declare function getRMS(audio: AudioData, channel?: number): number;
/**
 * ゼロクロッシング率を計算
 */
declare function getZeroCrossing(audio: AudioData, channel?: number): number;
/**
 * 波形データ取得のオプション
 */
interface WaveformOptions {
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
interface WaveformPoint {
    /** 時間位置（秒） */
    time: number;
    /** 振幅値（0-1） */
    amplitude: number;
}
/**
 * 波形データ取得結果
 */
interface WaveformResult {
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
declare function getWaveform(audio: AudioData, options?: WaveformOptions): WaveformResult;

/**
 * FFT分析のオプション
 */
interface FFTOptions {
    /** FFTサイズ（デフォルト: 2048、2の累乗である必要があります） */
    fftSize?: number;
    /** ウィンドウ関数（デフォルト: 'hann'） */
    windowFunction?: 'hann' | 'hamming' | 'blackman' | 'none';
    /** オーバーラップ率（デフォルト: 0.5） */
    overlap?: number;
    /** 解析するチャンネル（デフォルト: 0、-1で全チャンネルの平均） */
    channel?: number;
    /** FFTプロバイダー（デフォルト: 'webfft'） */
    provider?: FFTProviderType;
    /** プロファイリングを有効にする（WebFFTのみ） */
    enableProfiling?: boolean;
}
/**
 * スペクトラム解析のオプション
 */
interface SpectrumOptions extends FFTOptions {
    /** 最小周波数（Hz、デフォルト: 0） */
    minFrequency?: number;
    /** 最大周波数（Hz、デフォルト: ナイキスト周波数） */
    maxFrequency?: number;
    /** dB表示かどうか（デフォルト: true） */
    decibels?: boolean;
    /** 時間フレーム数（スペクトログラム用、デフォルト: 100） */
    timeFrames?: number;
}
/**
 * スペクトログラムデータ
 */
interface SpectrogramData {
    /** 時間軸（秒） */
    times: Float32Array;
    /** 周波数軸（Hz） */
    frequencies: Float32Array;
    /** 強度データ（時間 x 周波数） */
    intensities: Float32Array[];
    /** フレーム数 */
    timeFrames: number;
    /** 周波数ビン数 */
    frequencyBins: number;
}
/**
 * FFT分析結果
 */
interface FFTAnalysisResult extends FFTResult {
    /** FFTサイズ */
    fftSize: number;
    /** 使用されたウィンドウ関数 */
    windowFunction: string;
    /** プロバイダー名 */
    providerName: string;
}
/**
 * スペクトラム解析結果
 */
interface SpectrumAnalysisResult {
    /** 周波数（Hz） */
    frequencies: Float32Array;
    /** 強度 */
    magnitudes: Float32Array;
    /** dB値（decielsオプションがtrueの場合） */
    decibels?: Float32Array;
    /** スペクトログラム（timeFrames > 1の場合） */
    spectrogram?: SpectrogramData;
}
/**
 * FFT分析を行う
 *
 * @param audio - 音声データ
 * @param options - FFTオプション
 * @returns FFT結果
 */
declare function getFFT(audio: AudioData, options?: FFTOptions): Promise<FFTAnalysisResult>;
/**
 * スペクトラム解析を行う
 *
 * @param audio - 音声データ
 * @param options - スペクトラムオプション
 * @returns スペクトラム解析結果
 */
declare function getSpectrum(audio: AudioData, options?: SpectrumOptions): Promise<SpectrumAnalysisResult>;

export { type AudioData, AudioInspectError, type AudioSource, type ErrorCode, type FFTAnalysisResult, type FFTOptions, type FFTProviderConfig, FFTProviderFactory, type FFTProviderType, type FFTResult, type Feature, type IFFTProvider, type LoadOptions, type Peak, type PeaksOptions, type PeaksResult, type SpectrogramData, type SpectrumAnalysisResult, type SpectrumOptions, type StreamController, type StreamOptions, type WaveformOptions, type WaveformPoint, type WaveformResult, type WindowFunction, analyze, getFFT, getPeaks, getRMS, getSpectrum, getWaveform, getZeroCrossing, isAudioInspectError, load, stream };
