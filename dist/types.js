/**
 * audio-inspect固有のエラー
 */
export class AudioInspectError extends Error {
    code;
    cause;
    name = 'AudioInspectError';
    constructor(code, message, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
    }
}
/**
 * audio-inspect固有のエラーかチェック
 */
export function isAudioInspectError(error) {
    return error instanceof AudioInspectError;
}
