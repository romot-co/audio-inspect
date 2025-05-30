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
    profile?(): Promise<void>;
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
 * audio-inspect ライブラリの型定義
 */

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
type Feature<T> = (audio: AudioData, ...args: any[]) => T | Promise<T>;
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
    /** AudioInspectProcessorのモジュールURL（フル機能版を使用する場合） */
    processorModuleUrl?: string;
}
/**
 * 窓関数の種類
 */
type WindowFunction = 'hann' | 'hamming' | 'blackman' | 'rectangular';
/**
 * 振幅測定のオプション
 */
interface AmplitudeOptions {
    channel?: number;
    asDB?: boolean;
    reference?: number;
}
/**
 * 共通の解析オプション
 */
interface CommonAnalysisOptions {
    channel?: number;
}
/**
 * 時間窓パラメータ
 */
interface TimeWindowOptions {
    windowSizeMs?: number;
    hopSizeMs?: number;
}
/**
 * 周波数範囲パラメータ
 */
interface FrequencyRangeOptions {
    minFrequency?: number;
    maxFrequency?: number;
}
/**
 * エラーコード
 */
type ErrorCode = 'INVALID_INPUT' | 'UNSUPPORTED_FORMAT' | 'DECODE_ERROR' | 'NETWORK_ERROR' | 'FFT_PROVIDER_ERROR' | 'PROCESSING_ERROR' | 'INITIALIZATION_FAILED';
/**
 * Audio-inspect specific error
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
 * AudioInspectNodeのオプション
 */
interface AudioInspectNodeOptions {
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
interface AudioInspectProcessorOptions {
    featureName: string;
    featureOptions?: unknown;
    bufferSize: number;
    hopSize: number;
    inputChannelCount: number;
    provider?: FFTProviderType;
}
/**
 * AudioInspectNodeのイベントハンドラー
 */
interface AudioInspectNodeEventHandlers {
    onresult?: (event: {
        data: unknown;
        timestamp: number;
    }) => void;
    onerror?: (event: {
        message: string;
        detail?: unknown;
    }) => void;
}

/**
 * 音声データを読み込み、解析可能な形式に変換する
 */
declare function load(source: AudioSource, options?: LoadOptions): Promise<AudioData>;

/**
 * Extract features from audio data
 */
declare function analyze<T>(audio: AudioData, feature: Feature<T>): Promise<T>;

interface MockPort {
    postMessage: (message: unknown) => void;
    close: () => void;
    onmessage: ((event: MessageEvent) => void) | null;
}
declare class MockAudioWorkletNode {
    numberOfInputs: number;
    numberOfOutputs: number;
    channelCount: number;
    channelCountMode: ChannelCountMode;
    channelInterpretation: ChannelInterpretation;
    context: BaseAudioContext | null;
    port: MockPort;
    constructor();
    connect(): this;
    disconnect(): this;
    dispatchEvent(): boolean;
    addEventListener(): void;
    removeEventListener(): void;
}
declare const AudioInspectNode_base: {
    new (context: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions): AudioWorkletNode;
    prototype: AudioWorkletNode;
} | typeof MockAudioWorkletNode;
/**
 * Custom AudioNode: Provides real-time audio analysis
 * Extends AudioWorkletNode to function as a standard AudioNode
 */
declare class AudioInspectNode extends AudioInspectNode_base implements AudioInspectNodeEventHandlers {
    onresult?: (event: {
        data: unknown;
        timestamp: number;
    }) => void;
    onerror?: (event: {
        message: string;
        detail?: unknown;
    }) => void;
    private _featureName;
    private _featureOptions?;
    private _bufferSize;
    private _hopSize;
    private _provider?;
    constructor(context?: BaseAudioContext, nodeOptions?: AudioInspectNodeOptions);
    private _initializeMockMode;
    private getPort;
    private setupMessageHandler;
    /**
     * Get current analysis feature name (last set value)
     */
    get featureName(): string;
    /**
     * Get current analysis options (last set value)
     */
    get featureOptions(): unknown;
    /**
     * Get current buffer size (last set value)
     */
    get bufferSize(): number;
    /**
     * Get current hop size (last set value)
     */
    get hopSize(): number;
    /**
     * Get current FFT provider (last set value)
     */
    get provider(): FFTProviderType | undefined;
    /**
     * Update analysis options (supports partial updates)
     */
    updateOptions(options: Partial<AudioInspectNodeOptions>): void;
    /**
     * Reset internal state
     */
    reset(): void;
    /**
     * Release resources
     */
    dispose(): void;
    /**
     * Handle messages from processor
     */
    private handleMessage;
    /**
     * Handle analysis results
     */
    private handleAnalysisResult;
    /**
     * Handle errors
     */
    private handleError;
}

/**
 * ストリーミング解析を開始
 *
 * @param source - 音声ソース（MediaStream、AudioNode、AudioBuffer）
 * @param feature - 解析機能（関数または関数名の文字列）
 *                  注意: 関数オブジェクトを渡した場合でも、実際にはその名前（feature.name）が使用されます
 * @param options - ストリーミングオプション（processorModuleUrlは必須）
 * @param resultHandler - 結果を受け取るハンドラー
 * @param errorHandler - エラーを受け取るハンドラー
 * @returns ストリーミングコントローラー
 */
declare function stream<T>(source: AudioSource, feature: Feature<T> | string, options: StreamOptions & {
    processorModuleUrl: string;
}, // processorModuleUrlを必須に
resultHandler?: (result: T) => void, errorHandler?: (error: {
    message: string;
    detail?: unknown;
}) => void): Promise<StreamController>;
/**
 * 簡易AudioInspectNodeファクトリー関数（同期版）
 * E2Eテストや簡単な使用例向け
 * @param context - BaseAudioContext
 * @param options - ノードオプション
 * @returns AudioInspectNode
 */
declare function createAudioInspectNode(context: BaseAudioContext, options?: AudioInspectNodeOptions): AudioInspectNode;

/**
 * Safely get channel data common function
 * @param audio - AudioData object
 * @param channel - Channel number (-1 for average of all channels)
 * @returns Data of the specified channel
 * @throws AudioInspectError if channel is invalid
 */
declare function getChannelData(audio: AudioData, channel: number): Float32Array;
/**
 * Check if a number is a power of two
 */
declare function isPowerOfTwo(n: number): boolean;
/**
 * Calculate the next power of two
 */
declare function nextPowerOfTwo(n: number): number;
/**
 * Convert amplitude to dB
 */
declare function amplitudeToDecibels(amplitude: number, reference?: number): number;
/**
 * Convert dB to amplitude
 */
declare function decibelsToAmplitude(db: number, reference?: number): number;

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
declare function getRMS(audio: AudioData, optionsOrChannel?: AmplitudeOptions | number): number;
/**
 * ピーク振幅を計算
 */
declare function getPeakAmplitude(audio: AudioData, options?: AmplitudeOptions): number;

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

/**
 * スペクトル特徴量のオプション
 */
interface SpectralFeaturesOptions {
    /** FFTサイズ */
    fftSize?: number;
    /** 窓関数 */
    windowFunction?: 'hann' | 'hamming' | 'blackman' | 'none';
    /** 解析するチャンネル */
    channel?: number;
    /** 最小周波数 */
    minFrequency?: number;
    /** 最大周波数 */
    maxFrequency?: number;
    /** スペクトルロールオフの閾値（0-1） */
    rolloffThreshold?: number;
}
/**
 * スペクトル特徴量の結果
 */
interface SpectralFeaturesResult {
    /** スペクトル重心（Hz） */
    spectralCentroid: number;
    /** スペクトル帯域幅（Hz） */
    spectralBandwidth: number;
    /** スペクトルロールオフ（Hz） */
    spectralRolloff: number;
    /** スペクトルフラットネス（0-1） */
    spectralFlatness: number;
    /** スペクトルフラックス */
    spectralFlux?: number;
    /** ゼロ交差率 */
    zeroCrossingRate: number;
    /** 使用された周波数範囲 */
    frequencyRange: {
        min: number;
        max: number;
    };
}
/**
 * 時系列スペクトル特徴量のオプション
 */
interface TimeVaryingSpectralOptions extends SpectralFeaturesOptions {
    /** フレームサイズ */
    frameSize?: number;
    /** ホップサイズ */
    hopSize?: number;
    /** フレーム数（指定しない場合は全体を解析） */
    numFrames?: number;
}
/**
 * 時系列スペクトル特徴量の結果
 */
interface TimeVaryingSpectralResult {
    /** 時間軸（秒） */
    times: Float32Array;
    /** スペクトル重心の時系列 */
    spectralCentroid: Float32Array;
    /** スペクトル帯域幅の時系列 */
    spectralBandwidth: Float32Array;
    /** スペクトルロールオフの時系列 */
    spectralRolloff: Float32Array;
    /** スペクトルフラットネスの時系列 */
    spectralFlatness: Float32Array;
    /** スペクトルフラックスの時系列 */
    spectralFlux: Float32Array;
    /** ゼロ交差率の時系列 */
    zeroCrossingRate: Float32Array;
    /** フレーム情報 */
    frameInfo: {
        frameSize: number;
        hopSize: number;
        numFrames: number;
    };
}
/**
 * 単一フレームのスペクトル特徴量を計算
 * @param audio 音声データ
 * @param options オプション
 * @returns スペクトル特徴量
 */
declare function getSpectralFeatures(audio: AudioData, options?: SpectralFeaturesOptions): Promise<SpectralFeaturesResult>;
/**
 * 時系列スペクトル特徴量を計算
 * @param audio 音声データ
 * @param options オプション
 * @returns 時系列スペクトル特徴量
 */
declare function getTimeVaryingSpectralFeatures(audio: AudioData, options?: TimeVaryingSpectralOptions): Promise<TimeVaryingSpectralResult>;

interface EnergyOptions {
    frameSize?: number;
    hopSize?: number;
    channel?: number;
    normalized?: boolean;
    windowFunction?: 'rectangular' | 'hann' | 'hamming';
}
interface EnergyResult {
    times: Float32Array;
    energies: Float32Array;
    totalEnergy: number;
    statistics: {
        mean: number;
        std: number;
        max: number;
        min: number;
    };
}
declare function getEnergy(audio: AudioData, options?: EnergyOptions): EnergyResult;

interface CrestFactorOptions {
    channel?: number;
    windowSize?: number;
    hopSize?: number;
    method?: 'simple' | 'weighted';
}
interface CrestFactorResult {
    crestFactor: number;
    crestFactorLinear: number;
    peak: number;
    rms: number;
    timeVarying?: {
        times: Float32Array;
        values: Float32Array;
        valuesLinear: Float32Array;
        peaks: Float32Array;
        rmsValues: Float32Array;
    } | undefined;
}
declare function getCrestFactor(audio: AudioData, options?: CrestFactorOptions): CrestFactorResult;

interface StereoAnalysisOptions {
    frameSize?: number;
    hopSize?: number;
    calculatePhase?: boolean;
    calculateITD?: boolean;
    calculateILD?: boolean;
}
interface StereoAnalysisResult {
    correlation: number;
    coherence?: Float32Array;
    width: number;
    widthFrequency?: Float32Array;
    balance: number;
    phaseDifference?: number;
    phaseCorrelation?: number;
    midSideRatio: number;
    itd?: number;
    ild?: number;
    goniometer?: {
        x: Float32Array;
        y: Float32Array;
    };
}
declare function getStereoAnalysis(audio: AudioData, options?: StereoAnalysisOptions): Promise<StereoAnalysisResult>;
declare function getTimeVaryingStereoAnalysis(_audio: AudioData, _options?: StereoAnalysisOptions & {
    windowSize?: number;
}): Promise<{
    times: Float32Array;
    correlation: Float32Array;
    width: Float32Array;
    balance: Float32Array;
}>;

interface VADOptions {
    channel?: number;
    frameSizeMs?: number;
    hopSizeMs?: number;
    method?: 'energy' | 'zcr' | 'combined' | 'adaptive';
    energyThreshold?: number;
    zcrThresholdLow?: number;
    zcrThresholdHigh?: number;
    adaptiveAlpha?: number;
    noiseFactor?: number;
    minSilenceDurationMs?: number;
    minSpeechDurationMs?: number;
    preEmphasis?: boolean;
    smoothing?: boolean;
}
interface VADSegment {
    start: number;
    end: number;
    type: 'speech' | 'silence';
    confidence?: number;
}
interface VADResult {
    segments: VADSegment[];
    speechRatio: number;
    features?: {
        energies: Float32Array;
        zcrs: Float32Array;
        decisions: Float32Array;
        times: Float32Array;
    };
}
/**
 * VAD（音声区間検出）を実行
 */
declare function getVAD(audio: AudioData, options?: VADOptions): VADResult;

interface LUFSOptions {
    channelMode?: 'mono' | 'stereo';
    gated?: boolean;
    calculateShortTerm?: boolean;
    calculateMomentary?: boolean;
    calculateLoudnessRange?: boolean;
    calculateTruePeak?: boolean;
}
interface LUFSResult {
    integrated: number;
    shortTerm?: Float32Array;
    momentary?: Float32Array;
    loudnessRange?: number;
    truePeak?: number[];
    statistics?: {
        percentile10: number;
        percentile95: number;
    };
}
declare function getLUFS(audio: AudioData, options?: LUFSOptions): LUFSResult;

export { type AmplitudeOptions, type AudioData, AudioInspectError, AudioInspectNode, type AudioInspectNodeEventHandlers, type AudioInspectNodeOptions, type AudioInspectProcessorOptions, type AudioSource, type CommonAnalysisOptions, type CrestFactorOptions, type CrestFactorResult, type EnergyOptions, type EnergyResult, type ErrorCode, type FFTAnalysisResult, type FFTOptions, type FFTProviderConfig, FFTProviderFactory, type FFTProviderType, type FFTResult, type Feature, type FrequencyRangeOptions, type IFFTProvider, type LUFSOptions, type LUFSResult, type LoadOptions, type Peak, type PeaksOptions, type PeaksResult, type SpectralFeaturesOptions, type SpectralFeaturesResult, type SpectrogramData, type SpectrumAnalysisResult, type SpectrumOptions, type StereoAnalysisOptions, type StereoAnalysisResult, type StreamController, type StreamOptions, type TimeVaryingSpectralOptions, type TimeVaryingSpectralResult, type TimeWindowOptions, type VADOptions, type VADResult, type VADSegment, type WaveformOptions, type WaveformPoint, type WaveformResult, type WindowFunction, amplitudeToDecibels, analyze, createAudioInspectNode, decibelsToAmplitude, getChannelData, getCrestFactor, getEnergy, getFFT, getLUFS, getPeakAmplitude as getPeak, getPeakAmplitude, getPeaks, getRMS, getSpectralFeatures, getSpectrum, getStereoAnalysis, getTimeVaryingSpectralFeatures, getTimeVaryingStereoAnalysis, getVAD, getWaveform, getZeroCrossing, isAudioInspectError, isPowerOfTwo, load, nextPowerOfTwo, stream };
