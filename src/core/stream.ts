import { AudioSource, Feature, StreamOptions, StreamController, AudioInspectError } from '../types.js';

export function stream<T>(
  source: AudioSource, 
  feature: Feature<T>, 
  options?: StreamOptions
): AsyncIterableIterator<T> & StreamController {
  // 一時的な実装（将来的に完全実装予定）
  throw new AudioInspectError(
    'UNSUPPORTED_FORMAT',
    'stream機能は現在実装中です。次のバージョンで利用可能になります。'
  );
} 