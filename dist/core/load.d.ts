import { AudioSource, AudioData, LoadOptions } from '../types.js';
/**
 * 音声データを読み込み、解析可能な形式に変換する
 */
export declare function load(source: AudioSource, options?: LoadOptions): Promise<AudioData>;
