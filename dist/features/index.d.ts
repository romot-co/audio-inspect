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

export { type FFTAnalysisResult, type FFTOptions, type Peak, type PeaksOptions, type PeaksResult, type SpectrogramData, type SpectrumAnalysisResult, type SpectrumOptions, type WaveformOptions, type WaveformPoint, type WaveformResult, getFFT, getPeaks, getRMS, getSpectrum, getWaveform, getZeroCrossing };
