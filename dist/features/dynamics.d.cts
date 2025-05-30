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

export { type CrestFactorOptions, type CrestFactorResult, getCrestFactor };
