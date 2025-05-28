import { AudioData, Feature } from '../types.js';
/**
 * 音声データから特徴量を抽出する
 */
export declare function analyze<T>(audio: AudioData, feature: Feature<T>): Promise<T>;
