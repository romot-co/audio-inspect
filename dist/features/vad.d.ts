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

export { type VADOptions, type VADResult, type VADSegment, getVAD };
