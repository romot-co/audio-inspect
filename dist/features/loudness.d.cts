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

export { type LUFSOptions, type LUFSResult, getLUFS };
