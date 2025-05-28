import { describe, it, expect, vi } from 'vitest';
import { analyze } from '../../src/core/analyze.js';
import { AudioInspectError } from '../../src/types.js';
import type { AudioData, Feature } from '../../src/types.js';

// テスト用のAudioDataを作成するヘルパー
function createTestAudioData(options: Partial<AudioData> = {}): AudioData {
  const sampleRate = options.sampleRate ?? 44100;
  const duration = options.duration ?? 1;
  const length = options.length ?? sampleRate * duration;
  
  // 負の値やゼロの場合はデフォルト値を使用（バリデーション用のテスト以外）
  const safeLength = Math.max(1, length);
  const channelData = options.channelData ?? [new Float32Array(safeLength)];
  
  return {
    sampleRate,
    channelData,
    duration,
    numberOfChannels: channelData.length,
    length,
    ...options
  };
}

describe('analyze', () => {
  it('should execute feature function and return result', async () => {
    const audio = createTestAudioData();
    const mockFeature: Feature<number> = vi.fn().mockResolvedValue(42);
    
    const result = await analyze(audio, mockFeature);
    
    expect(result).toBe(42);
    expect(mockFeature).toHaveBeenCalledWith(audio);
    expect(mockFeature).toHaveBeenCalledTimes(1);
  });

  it('should handle synchronous feature functions', async () => {
    const audio = createTestAudioData();
    const mockFeature: Feature<string> = vi.fn().mockReturnValue('sync result');
    
    const result = await analyze(audio, mockFeature);
    
    expect(result).toBe('sync result');
    expect(mockFeature).toHaveBeenCalledWith(audio);
  });

  it('should validate AudioData before executing feature', async () => {
    const invalidAudio = null as any;
    const mockFeature: Feature<number> = vi.fn();
    
    await expect(analyze(invalidAudio, mockFeature))
      .rejects.toThrow(AudioInspectError);
    
    expect(mockFeature).not.toHaveBeenCalled();
  });

  describe('AudioData validation', () => {
    it('should reject null or undefined audio', async () => {
      const mockFeature: Feature<number> = vi.fn();
      
      await expect(analyze(null as any, mockFeature))
        .rejects.toThrow('AudioDataが無効です');
        
      await expect(analyze(undefined as any, mockFeature))
        .rejects.toThrow('AudioDataが無効です');
    });

    it('should reject invalid sampleRate', async () => {
      const mockFeature: Feature<number> = vi.fn();
      
      const invalidAudio: AudioData = {
        sampleRate: 0,
        channelData: [new Float32Array(1000)],
        duration: 1,
        numberOfChannels: 1,
        length: 1000
      };
      
      await expect(analyze(invalidAudio, mockFeature))
        .rejects.toThrow('サンプルレートが無効です');
        
      const negativeAudio: AudioData = {
        sampleRate: -44100,
        channelData: [new Float32Array(1000)],
        duration: 1,
        numberOfChannels: 1,
        length: 1000
      };
      
      await expect(analyze(negativeAudio, mockFeature))
        .rejects.toThrow('サンプルレートが無効です');
    });

    it('should reject invalid channelData', async () => {
      const mockFeature: Feature<number> = vi.fn();
      
      const noChannels: AudioData = {
        sampleRate: 44100,
        channelData: [],
        duration: 1,
        numberOfChannels: 0,
        length: 1000
      };
      
      await expect(analyze(noChannels, mockFeature))
        .rejects.toThrow('チャンネルデータが無効です');
        
      const nonArrayChannels: AudioData = {
        sampleRate: 44100,
        channelData: null as any,
        duration: 1,
        numberOfChannels: 1,
        length: 1000
      };
      
      await expect(analyze(nonArrayChannels, mockFeature))
        .rejects.toThrow('チャンネルデータが無効です');
    });

    it('should reject mismatched numberOfChannels', async () => {
      const mockFeature: Feature<number> = vi.fn();
      
      const mismatchedAudio: AudioData = {
        sampleRate: 44100,
        channelData: [new Float32Array(1000), new Float32Array(1000)],
        duration: 1,
        numberOfChannels: 1, // Should be 2
        length: 1000
      };
      
      await expect(analyze(mismatchedAudio, mockFeature))
        .rejects.toThrow('チャンネル数が一致しません');
    });

    it('should reject invalid length', async () => {
      const mockFeature: Feature<number> = vi.fn();
      
      const zeroLength: AudioData = {
        sampleRate: 44100,
        channelData: [new Float32Array(1000)],
        duration: 1,
        numberOfChannels: 1,
        length: 0
      };
      
      await expect(analyze(zeroLength, mockFeature))
        .rejects.toThrow('データ長が無効です');
        
      const negativeLength: AudioData = {
        sampleRate: 44100,
        channelData: [new Float32Array(1000)],
        duration: 1,
        numberOfChannels: 1,
        length: -100
      };
      
      await expect(analyze(negativeLength, mockFeature))
        .rejects.toThrow('データ長が無効です');
    });

    it('should reject invalid duration', async () => {
      const mockFeature: Feature<number> = vi.fn();
      
      const zeroDuration: AudioData = {
        sampleRate: 44100,
        channelData: [new Float32Array(1000)],
        duration: 0,
        numberOfChannels: 1,
        length: 1000
      };
      
      await expect(analyze(zeroDuration, mockFeature))
        .rejects.toThrow('音声の長さが無効です');
        
      const negativeDuration: AudioData = {
        sampleRate: 44100,
        channelData: [new Float32Array(1000)],
        duration: -1,
        numberOfChannels: 1,
        length: 1000
      };
      
      await expect(analyze(negativeDuration, mockFeature))
        .rejects.toThrow('音声の長さが無効です');
    });

    it('should reject non-Float32Array channel data', async () => {
      const mockFeature: Feature<number> = vi.fn();
      
      const invalidChannelData = createTestAudioData({
        channelData: [new Array(1000) as any] // Should be Float32Array
      });
      
      await expect(analyze(invalidChannelData, mockFeature))
        .rejects.toThrow('チャンネル 0 のデータが Float32Array ではありません');
    });

    it('should reject mismatched channel data lengths', async () => {
      const mockFeature: Feature<number> = vi.fn();
      
      const mismatchedLengths = createTestAudioData({
        channelData: [
          new Float32Array(1000),
          new Float32Array(500) // Different length
        ],
        numberOfChannels: 2
      });
      
      await expect(analyze(mismatchedLengths, mockFeature))
        .rejects.toThrow('チャンネル 1 のデータ長が一致しません');
    });
  });

  describe('error handling', () => {
    it('should wrap feature function errors in AudioInspectError', async () => {
      const audio = createTestAudioData();
      const originalError = new Error('Feature failed');
      const mockFeature: Feature<number> = vi.fn().mockRejectedValue(originalError);
      
      await expect(analyze(audio, mockFeature))
        .rejects.toThrow(AudioInspectError);
        
      try {
        await analyze(audio, mockFeature);
      } catch (error) {
        expect(error).toBeInstanceOf(AudioInspectError);
        expect((error as AudioInspectError).code).toBe('PROCESSING_ERROR');
        expect((error as AudioInspectError).message).toContain('特徴量の抽出に失敗しました');
        expect((error as AudioInspectError).cause).toBe(originalError);
      }
    });

    it('should handle feature function throwing non-Error values', async () => {
      const audio = createTestAudioData();
      const mockFeature: Feature<number> = vi.fn().mockRejectedValue('string error');
      
      await expect(analyze(audio, mockFeature))
        .rejects.toThrow(AudioInspectError);
        
      try {
        await analyze(audio, mockFeature);
      } catch (error) {
        expect(error).toBeInstanceOf(AudioInspectError);
        expect((error as AudioInspectError).message).toContain('Unknown error');
      }
    });
  });

  describe('complex AudioData validation', () => {
    it('should accept valid multi-channel audio', async () => {
      const audio = createTestAudioData({
        channelData: [
          new Float32Array(1000),
          new Float32Array(1000)
        ],
        numberOfChannels: 2,
        length: 1000
      });
      
      const mockFeature: Feature<number> = vi.fn().mockResolvedValue(123);
      
      const result = await analyze(audio, mockFeature);
      expect(result).toBe(123);
      expect(mockFeature).toHaveBeenCalledWith(audio);
    });

    it('should accept audio with different sample rates', async () => {
      const sampleRates = [8000, 16000, 22050, 44100, 48000, 96000];
      const mockFeature: Feature<number> = vi.fn().mockResolvedValue(1);
      
      for (const sampleRate of sampleRates) {
        const audio = createTestAudioData({ sampleRate });
        const result = await analyze(audio, mockFeature);
        expect(result).toBe(1);
      }
      
      expect(mockFeature).toHaveBeenCalledTimes(sampleRates.length);
    });
  });
}); 