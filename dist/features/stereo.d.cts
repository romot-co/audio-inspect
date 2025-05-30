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

export { type StereoAnalysisOptions, type StereoAnalysisResult, getStereoAnalysis, getTimeVaryingStereoAnalysis };
