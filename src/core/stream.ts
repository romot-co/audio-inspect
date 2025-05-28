import { AudioSource, Feature, StreamController, StreamOptions, AudioInspectError } from '../types.js';

export function stream<T>(
  _source: AudioSource,
  _feature: Feature<T>,
  _options?: StreamOptions
): StreamController {
  // TODO: ストリーミング機能の実装
  throw new AudioInspectError(
    'UNSUPPORTED_FORMAT',
    'stream機能は現在実装中です。次のバージョンで利用可能になります。'
  );
}
