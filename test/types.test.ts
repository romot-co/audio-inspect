import { describe, it, expect } from 'vitest';
import { AudioInspectError, isAudioInspectError } from '../src/types.js';

describe('Types', () => {
  describe('AudioInspectError', () => {
    it('should create an error with code and message', () => {
      const error = new AudioInspectError('DECODE_ERROR', 'Test error message');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AudioInspectError');
      expect(error.code).toBe('DECODE_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.cause).toBeUndefined();
    });

    it('should create an error with cause', () => {
      const originalError = new Error('Original error');
      const error = new AudioInspectError('PROCESSING_ERROR', 'Wrapper error', originalError);
      
      expect(error.code).toBe('PROCESSING_ERROR');
      expect(error.message).toBe('Wrapper error');
      expect(error.cause).toBe(originalError);
    });

    it('should have correct error codes', () => {
      const codes = ['DECODE_ERROR', 'UNSUPPORTED_FORMAT', 'NETWORK_ERROR', 'INVALID_INPUT', 'PROCESSING_ERROR'] as const;
      
      codes.forEach(code => {
        const error = new AudioInspectError(code, 'Test message');
        expect(error.code).toBe(code);
      });
    });
  });

  describe('isAudioInspectError', () => {
    it('should return true for AudioInspectError instances', () => {
      const error = new AudioInspectError('DECODE_ERROR', 'Test error');
      expect(isAudioInspectError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Regular error');
      expect(isAudioInspectError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isAudioInspectError(null)).toBe(false);
      expect(isAudioInspectError(undefined)).toBe(false);
      expect(isAudioInspectError('error string')).toBe(false);
      expect(isAudioInspectError(42)).toBe(false);
      expect(isAudioInspectError({})).toBe(false);
    });
  });
}); 