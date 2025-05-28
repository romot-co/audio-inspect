import { describe, it, expect } from 'vitest';
import { stream } from '../../src/core/stream.js';
import { AudioInspectError } from '../../src/types.js';

describe('stream', () => {
  it('should throw not implemented error', () => {
    const mockSource = new ArrayBuffer(1024);
    const mockFeature = (): number => 42;

    expect(() => {
      stream(mockSource, mockFeature);
    }).toThrow(AudioInspectError);

    expect(() => {
      stream(mockSource, mockFeature);
    }).toThrow('stream機能は現在実装中です');
  });

  it('should throw error with correct error code', () => {
    const mockSource = new ArrayBuffer(1024);
    const mockFeature = (): number => 42;

    try {
      stream(mockSource, mockFeature);
    } catch (error) {
      expect(error).toBeInstanceOf(AudioInspectError);
      if (error instanceof AudioInspectError) {
        expect(error.code).toBe('UNSUPPORTED_FORMAT');
      }
    }
  });

  it('should handle different source types', () => {
    const mockFeature = (): number => 42;

    const sources = [new ArrayBuffer(1024), new Blob(['test']), 'http://example.com/audio.mp3'];

    sources.forEach((source) => {
      expect(() => {
        stream(source, mockFeature);
      }).toThrow(AudioInspectError);
    });
  });
});
