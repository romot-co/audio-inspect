import { describe, it, expect } from 'vitest';
import { getLUFS, getLUFSRealtime } from '../../src/features/loudness.js';
import type { AudioData } from '../../src/types.js';

// テスト用のAudioDataを作成するヘルパー
function createTestAudioData(data: Float32Array[], sampleRate = 48000): AudioData {
  return {
    sampleRate,
    channelData: data,
    duration: data[0] ? data[0].length / sampleRate : 0,
    numberOfChannels: data.length,
    length: data[0] ? data[0].length : 0
  };
}

// テスト信号を生成するヘルパー関数
function createSineWave(
  frequency: number,
  duration: number,
  sampleRate = 48000,
  amplitude = 1
): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const data = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    data[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
  }

  return data;
}

function createPinkNoise(length: number, amplitude = 1): Float32Array {
  const data = new Float32Array(length);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;

  for (let i = 0; i < length; i++) {
    const white = (Math.random() - 0.5) * 2;

    // Pink noise filter
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;

    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;

    data[i] = pink * amplitude * 0.11; // Scale down
  }

  return data;
}

describe('getLUFS', () => {
  describe('basic functionality', () => {
    it('should calculate LUFS for sine wave', () => {
      const sineWave = createSineWave(1000, 5.0, 48000, 0.1); // 5秒、低振幅
      const audio = createTestAudioData([sineWave]);

      const result = getLUFS(audio);

      expect(result.integrated).toBeDefined();
      expect(result.integrated).toBeTypeOf('number');
      expect(result.integrated).toBeLessThan(0); // LUFS値は通常負の値
      expect(result.integrated).toBeGreaterThan(-100); // 合理的な範囲
    });

    it('should handle stereo audio', () => {
      const left = createSineWave(1000, 5.0, 48000, 0.1);
      const right = createSineWave(1500, 5.0, 48000, 0.1);
      const audio = createTestAudioData([left, right]);

      const result = getLUFS(audio, { channelMode: 'stereo' });

      expect(result.integrated).toBeDefined();
      expect(result.integrated).toBeTypeOf('number');
      expect(result.integrated).toBeLessThan(0);
    });

    it('should handle mono audio explicitly', () => {
      const mono = createSineWave(1000, 5.0, 48000, 0.1);
      const audio = createTestAudioData([mono]);

      const result = getLUFS(audio, { channelMode: 'mono' });

      expect(result.integrated).toBeDefined();
      expect(result.integrated).toBeTypeOf('number');
    });

    it('should handle silent audio', () => {
      const silence = new Float32Array(48000 * 5); // 5秒の無音
      const audio = createTestAudioData([silence]);

      const result = getLUFS(audio);

      expect(result.integrated).toBeDefined();
      expect(result.integrated).toBeLessThan(-50); // 非常に小さな値
    });
  });

  describe('gating options', () => {
    it('should support gated measurement', () => {
      const signal = createSineWave(1000, 10.0, 48000, 0.1);
      const audio = createTestAudioData([signal]);

      const gated = getLUFS(audio, { gated: true });
      const ungated = getLUFS(audio, { gated: false });

      expect(gated.integrated).toBeDefined();
      expect(ungated.integrated).toBeDefined();
      // ゲートありとなしで結果が異なることがある
    });
  });

  describe('additional measurements', () => {
    it('should calculate short-term loudness when requested', () => {
      const signal = createSineWave(1000, 10.0, 48000, 0.1);
      const audio = createTestAudioData([signal]);

      const result = getLUFS(audio, { calculateShortTerm: true });

      expect(result.shortTerm).toBeDefined();
      if (result.shortTerm) {
        expect(result.shortTerm).toBeInstanceOf(Float32Array);
        expect(result.shortTerm.length).toBeGreaterThan(0);
      }
    });

    it('should calculate momentary loudness when requested', () => {
      const signal = createSineWave(1000, 5.0, 48000, 0.1);
      const audio = createTestAudioData([signal]);

      const result = getLUFS(audio, { calculateMomentary: true });

      expect(result.momentary).toBeDefined();
      if (result.momentary) {
        expect(result.momentary).toBeInstanceOf(Float32Array);
        expect(result.momentary.length).toBeGreaterThan(0);
      }
    });

    it('should calculate loudness range when requested', () => {
      const signal = createPinkNoise(48000 * 10, 0.1); // 10秒のピンクノイズ
      const audio = createTestAudioData([signal]);

      const result = getLUFS(audio, { calculateLoudnessRange: true });

      // loudnessRangeは実装されていない可能性がある
      if (result.loudnessRange !== undefined) {
        expect(result.loudnessRange).toBeTypeOf('number');
        expect(result.loudnessRange).toBeGreaterThan(0);
      }
    });

    it('should calculate true peak when requested', () => {
      const signal = createSineWave(1000, 5.0, 48000, 0.5);
      const audio = createTestAudioData([signal]);

      const result = getLUFS(audio, { calculateTruePeak: true });

      expect(result.truePeak).toBeDefined();
      if (result.truePeak) {
        expect(result.truePeak).toBeInstanceOf(Array);
        expect(result.truePeak.length).toBe(1); // モノラル信号
        expect(result.truePeak[0]).toBeTypeOf('number');
      }
    });

    it('should calculate statistics when loudness range is enabled', () => {
      const signal = createPinkNoise(48000 * 10, 0.1);
      const audio = createTestAudioData([signal]);

      const result = getLUFS(audio, { calculateLoudnessRange: true });

      // statisticsは実装されていない可能性がある
      if (result.statistics) {
        expect(result.statistics.percentile10).toBeTypeOf('number');
        expect(result.statistics.percentile95).toBeTypeOf('number');
        expect(result.statistics.percentile95).toBeGreaterThan(result.statistics.percentile10);
      }
    });
  });

  describe('multi-channel support', () => {
    it('should handle stereo true peak calculation', () => {
      const left = createSineWave(1000, 3.0, 48000, 0.3);
      const right = createSineWave(1500, 3.0, 48000, 0.4);
      const audio = createTestAudioData([left, right]);

      const result = getLUFS(audio, {
        channelMode: 'stereo',
        calculateTruePeak: true
      });

      expect(result.truePeak).toBeDefined();
      if (result.truePeak) {
        expect(result.truePeak.length).toBe(2); // ステレオ信号
        expect(result.truePeak[0]).toBeTypeOf('number');
        expect(result.truePeak[1]).toBeTypeOf('number');
      }
    });

    it('should auto-detect channel mode', () => {
      const left = createSineWave(1000, 3.0, 48000, 0.1);
      const right = createSineWave(1500, 3.0, 48000, 0.1);
      const stereoAudio = createTestAudioData([left, right]);

      const mono = createSineWave(1000, 3.0, 48000, 0.1);
      const monoAudio = createTestAudioData([mono]);

      const stereoResult = getLUFS(stereoAudio); // auto-detect stereo
      const monoResult = getLUFS(monoAudio); // auto-detect mono

      expect(stereoResult.integrated).toBeDefined();
      expect(monoResult.integrated).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw error for empty audio', () => {
      const emptyAudio = createTestAudioData([]);

      expect(() => getLUFS(emptyAudio)).toThrow();
    });

    it('should throw error for zero channels', () => {
      const invalidAudio: AudioData = {
        sampleRate: 48000,
        channelData: [],
        duration: 0,
        numberOfChannels: 0,
        length: 0
      };

      expect(() => getLUFS(invalidAudio)).toThrow('処理可能なチャンネルがありません');
    });

    it('should handle very short audio', () => {
      const shortSignal = createSineWave(1000, 0.1, 48000, 0.1); // 100ms
      const audio = createTestAudioData([shortSignal]);

      // 短すぎる信号でもエラーにならずに処理される
      expect(() => getLUFS(audio)).not.toThrow();
    });
  });

  describe('different sample rates', () => {
    it('should handle 44.1kHz sample rate', () => {
      const signal = createSineWave(1000, 5.0, 44100, 0.1);
      const audio = createTestAudioData([signal], 44100);

      const result = getLUFS(audio);

      expect(result.integrated).toBeDefined();
      expect(result.integrated).toBeTypeOf('number');
    });

    it('should handle 96kHz sample rate', () => {
      const signal = createSineWave(1000, 5.0, 96000, 0.1);
      const audio = createTestAudioData([signal], 96000);

      const result = getLUFS(audio);

      expect(result.integrated).toBeDefined();
      expect(result.integrated).toBeTypeOf('number');
    });
  });

  describe('signal characteristics', () => {
    it('should show different LUFS for different amplitudes', () => {
      const quiet = createSineWave(1000, 5.0, 48000, 0.01);
      const loud = createSineWave(1000, 5.0, 48000, 0.1);

      const quietAudio = createTestAudioData([quiet]);
      const loudAudio = createTestAudioData([loud]);

      const quietResult = getLUFS(quietAudio);
      const loudResult = getLUFS(loudAudio);

      expect(loudResult.integrated).toBeGreaterThan(quietResult.integrated);
    });

    it('should handle complex signals', () => {
      // 複数の周波数成分を持つ信号
      const signal = new Float32Array(48000 * 5);
      for (let i = 0; i < signal.length; i++) {
        const t = i / 48000;
        signal[i] =
          0.1 * Math.sin(2 * Math.PI * 440 * t) +
          0.05 * Math.sin(2 * Math.PI * 880 * t) +
          0.03 * Math.sin(2 * Math.PI * 1320 * t);
      }

      const audio = createTestAudioData([signal]);
      const result = getLUFS(audio);

      expect(result.integrated).toBeDefined();
      expect(result.integrated).toBeTypeOf('number');
      expect(result.integrated).toBeLessThan(0);
    });
  });

  describe('comprehensive measurement', () => {
    it('should calculate all measurements together', () => {
      const signal = createPinkNoise(48000 * 10, 0.1); // 10秒
      const audio = createTestAudioData([signal]);

      const result = getLUFS(audio, {
        gated: true,
        calculateShortTerm: true,
        calculateMomentary: true,
        calculateLoudnessRange: true,
        calculateTruePeak: true
      });

      expect(result.integrated).toBeDefined();
      expect(result.shortTerm).toBeDefined();
      expect(result.momentary).toBeDefined();
      expect(result.loudnessRange).toBeDefined();
      expect(result.truePeak).toBeDefined();
      expect(result.statistics).toBeDefined();

      // すべての値が合理的な範囲内にある
      expect(result.integrated).toBeLessThan(0);
      if (result.loudnessRange !== undefined) {
        expect(result.loudnessRange).toBeGreaterThan(0);
      }
      if (result.truePeak) {
        expect(result.truePeak.length).toBe(1);
      }
    });
  });

  describe('getLUFSRealtime', () => {
    it('should process audio chunks in real-time', () => {
      const processor = getLUFSRealtime(48000, { channelMode: 'mono' });

      // 100msのチャンクを処理
      const chunkSize = 4800; // 100ms
      const blockSize = Math.floor(0.4 * 48000); // 400ms = 19200 samples

      for (let i = 0; i < 10; i++) {
        const chunk = createSineWave(1000, chunkSize / 48000, 48000, 0.1);
        const result = processor.process([chunk]);

        // 最初のブロックが完成するまではデータがない
        // 400ms必要なので、100msチャンクなら4つ以上必要
        const samplesProcessed = (i + 1) * chunkSize;
        if (samplesProcessed < blockSize) {
          expect(result.integrated).toBe(-Infinity);
        } else {
          expect(result.integrated).toBeTypeOf('number');
          expect(result.momentary).toBeTypeOf('number');
          expect(result.shortTerm).toBeTypeOf('number');
        }
      }
    });

    it('should handle stereo processing', () => {
      const processor = getLUFSRealtime(48000, { channelMode: 'stereo' });

      const chunkSize = 4800; // 100ms
      const left = createSineWave(1000, chunkSize / 48000, 48000, 0.1);
      const right = createSineWave(1500, chunkSize / 48000, 48000, 0.1);

      for (let i = 0; i < 50; i++) {
        const result = processor.process([left, right]);

        if (i > 10) {
          // 十分なデータが蓄積された後
          expect(result.integrated).toBeTypeOf('number');
          expect(result.integrated).toBeLessThan(0);
        }
      }
    });

    it('should calculate momentary loudness correctly', () => {
      const processor = getLUFSRealtime(48000, { channelMode: 'mono' });

      // 400msのチャンクを処理
      const chunkSize = 19200; // 400ms
      const signal = createSineWave(1000, chunkSize / 48000, 48000, 0.1);

      const result = processor.process([signal]);

      // 400msのデータがあればmomentaryが計算される
      expect(result.momentary).toBeTypeOf('number');
      expect(result.momentary).toBeLessThan(0);
    });

    it('should calculate short-term loudness correctly', () => {
      const processor = getLUFSRealtime(48000, { channelMode: 'mono' });

      // 3秒分のデータを100msずつ処理
      const chunkSize = 4800; // 100ms
      let lastResult;

      for (let i = 0; i < 30; i++) {
        // 3秒
        const chunk = createSineWave(1000, chunkSize / 48000, 48000, 0.1);
        lastResult = processor.process([chunk]);
      }

      // 3秒のデータがあればshortTermが計算される
      expect(lastResult!.shortTerm).toBeTypeOf('number');
      expect(lastResult!.shortTerm).toBeLessThan(0);
    });

    it('should reset state correctly', () => {
      const processor = getLUFSRealtime(48000, { channelMode: 'mono' });

      // 500ms (0.5秒) のチャンクを処理 - これは1ブロック以上
      const chunk = createSineWave(1000, 0.5, 48000, 0.1);
      processor.process([chunk]);

      expect(processor.getBufferSize()).toBeGreaterThan(0);

      // リセット
      processor.reset();

      expect(processor.getBufferSize()).toBe(0);

      // リセット後の最初の処理 - 100msのチャンクを使用
      const smallChunk = createSineWave(1000, 0.1, 48000, 0.1);
      const result = processor.process([smallChunk]);
      expect(result.integrated).toBe(-Infinity);
    });

    it('should maintain buffer size limit', () => {
      const processor = getLUFSRealtime(48000, {
        channelMode: 'mono',
        maxDurationMs: 5000
      }); // 5秒の最大バッファ

      // 10秒分のデータを処理
      const chunkSize = 4800; // 100ms
      for (let i = 0; i < 100; i++) {
        const chunk = createSineWave(1000, chunkSize / 48000, 48000, 0.1);
        processor.process([chunk]);
      }

      // バッファサイズが制限内に収まっている
      const expectedMaxBlocks = Math.ceil(5000 / 100); // 5秒 / 100ms hop
      expect(processor.getBufferSize()).toBeLessThanOrEqual(expectedMaxBlocks);
    });

    it('should produce consistent results with batch processing', () => {
      // バッチ処理
      const signal = createSineWave(1000, 5.0, 48000, 0.1);
      const audio = createTestAudioData([signal]);
      const batchResult = getLUFS(audio, { calculateMomentary: true });

      // リアルタイム処理
      const processor = getLUFSRealtime(48000, { channelMode: 'mono' });
      const chunkSize = 4800; // 100ms
      let realtimeResult;

      for (let i = 0; i < Math.floor(signal.length / chunkSize); i++) {
        const chunk = signal.subarray(i * chunkSize, (i + 1) * chunkSize);
        realtimeResult = processor.process([new Float32Array(chunk)]);
      }

      // 結果が近似的に一致する（完全一致は期待しない）
      expect(Math.abs(realtimeResult!.integrated - batchResult.integrated)).toBeLessThan(1); // 1 LU以内
    });
  });
});
