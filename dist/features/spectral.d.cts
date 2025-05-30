/**
 * audio-inspect ライブラリの型定義
 */

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

export { type SpectralFeaturesOptions, type SpectralFeaturesResult, type TimeVaryingSpectralOptions, type TimeVaryingSpectralResult, getSpectralFeatures, getTimeVaryingSpectralFeatures };
