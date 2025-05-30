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

export { type EnergyOptions, type EnergyResult, getEnergy };
