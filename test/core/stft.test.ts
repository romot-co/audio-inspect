import { describe, it, expect } from 'vitest';
import {
  generateWindow,
  stft,
  istft,
  STFTProcessor,
  RealtimeSTFTProcessor,
  WindowType
} from '../../src/core/stft.js';

// テスト用のヘルパー関数
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

function createComplexSignal(sampleRate = 48000, duration = 1): Float32Array {
  const length = Math.floor(duration * sampleRate);
  const data = new Float32Array(length);

  // 複数の周波数成分を持つ信号
  const frequencies = [440, 880, 1320, 1760];
  const amplitudes = [1, 0.5, 0.3, 0.2];

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    data[i] = frequencies.reduce((sum, freq, idx) => {
      return sum + (amplitudes[idx] ?? 0) * Math.sin(2 * Math.PI * freq * t);
    }, 0);
  }

  return data;
}

describe('Window Functions', () => {
  it('should generate Hann window', () => {
    const window = generateWindow('hann', 256);

    expect(window.length).toBe(256);
    expect(window[0]).toBeCloseTo(0, 5);
    expect(window[127]).toBeCloseTo(1, 3); // 中央位置
    expect(window[255]).toBeCloseTo(0, 5);
  });

  it('should generate Hamming window', () => {
    const window = generateWindow('hamming', 256);

    expect(window.length).toBe(256);
    expect(window[0]).toBeCloseTo(0.08, 2);
    expect(window[127]).toBeCloseTo(1, 3); // 中央位置
    expect(window[255]).toBeCloseTo(0.08, 2);
  });

  it('should generate Blackman window', () => {
    const window = generateWindow('blackman', 256);

    expect(window.length).toBe(256);
    expect(window[0]).toBeCloseTo(0, 5);
    expect(window[127]).toBeCloseTo(1, 3); // 中央位置
    expect(window[255]).toBeCloseTo(0, 5);
  });

  it('should generate Bartlett window', () => {
    const window = generateWindow('bartlett', 256);

    expect(window.length).toBe(256);
    expect(window[0]).toBeCloseTo(0, 5);
    expect(window[127]).toBeCloseTo(1, 2); // 中央位置
    expect(window[255]).toBeCloseTo(0, 5);
  });

  it('should generate Kaiser window with beta parameter', () => {
    const window = generateWindow('kaiser', 256, { kaiserBeta: 8.6 });

    expect(window.length).toBe(256);
    expect(window[0]).toBeCloseTo(0, 2);
    expect(window[127]).toBeCloseTo(1, 3); // 中央位置
    expect(window[255]).toBeCloseTo(0, 2);
  });

  it('should generate Tukey window with alpha parameter', () => {
    const window = generateWindow('tukey', 256, { tukeyAlpha: 0.5 });

    expect(window.length).toBe(256);
    expect(window[64]).toBeGreaterThan(0.5);
    expect(window[128]).toBe(1);
    expect(window[192]).toBeGreaterThan(0.5);
  });

  it('should generate rectangular window', () => {
    const window = generateWindow('rectangular', 256);

    expect(window.length).toBe(256);
    expect(window.every((v) => v === 1)).toBe(true);
  });

  it('should throw error for unknown window type', () => {
    expect(() => generateWindow('unknown' as WindowType, 256)).toThrow('Unknown window type');
  });
});

describe('STFT/iSTFT', () => {
  describe('Basic functionality', () => {
    it('should perform STFT on sine wave', () => {
      const signal = createSineWave(1000, 0.1, 48000);
      const result = stft(signal, 48000, { fftSize: 2048, windowType: 'hann' });

      expect(result.frameCount).toBeGreaterThan(0);
      expect(result.frequencyBins).toBe(1025);
      expect(result.complex.length).toBe(result.frameCount);
      expect(result.magnitude.length).toBe(result.frameCount);
      expect(result.phase.length).toBe(result.frameCount);

      // 1000Hz付近にピークがあるはず
      const targetBin = Math.round((1000 * 2048) / 48000);
      result.magnitude.forEach((frame) => {
        const maxIdx = frame.indexOf(Math.max(...frame));
        expect(Math.abs(maxIdx - targetBin)).toBeLessThan(3);
      });
    });

    it('should reconstruct signal with iSTFT', () => {
      const original = createSineWave(1000, 0.1, 48000, 0.5);
      const stftResult = stft(original, 48000, {
        fftSize: 2048,
        windowType: 'hann',
        hopSize: 512
      });

      const reconstructed = istft(
        stftResult,
        48000,
        {
          fftSize: 2048,
          windowType: 'hann',
          hopSize: 512
        },
        original.length
      );

      expect(reconstructed.length).toBe(original.length);

      // 中央部分で比較（エッジ効果を避ける）
      const start = 2048;
      const end = original.length - 2048;
      let mse = 0;

      for (let i = start; i < end; i++) {
        const diff = (original[i] ?? 0) - (reconstructed[i] ?? 0);
        mse += diff * diff;
      }

      mse /= end - start;
      expect(mse).toBeLessThan(0.001); // 再構成誤差が小さい
    });

    it('should handle different window sizes', () => {
      const signal = createComplexSignal(48000, 0.5);

      const result1 = stft(signal, 48000, { fftSize: 4096, windowSize: 2048 });
      const result2 = stft(signal, 48000, { fftSize: 2048, windowSize: 1024 });

      expect(result1.frequencyBins).toBe(2049);
      expect(result2.frequencyBins).toBe(1025);
    });

    it('should handle different hop sizes', () => {
      const signal = createComplexSignal(48000, 0.5);

      const result1 = stft(signal, 48000, { fftSize: 2048, hopSize: 512 });
      const result2 = stft(signal, 48000, { fftSize: 2048, hopSize: 1024 });

      expect(result1.frameCount).toBeGreaterThan(result2.frameCount);
      expect(result1.frameCount).toBeCloseTo(result2.frameCount * 2, -1);
    });
  });

  describe('Normalization modes', () => {
    it('should apply forward normalization', () => {
      const signal = createSineWave(1000, 0.1, 48000);
      const result = stft(signal, 48000, {
        fftSize: 2048,
        normalize: 'forward'
      });

      // Forward normalizationではエネルギーが1/Nでスケール
      const maxMag = Math.max(...(result.magnitude[0] ?? new Float32Array()));
      expect(maxMag).toBeLessThan(1);
    });

    it('should apply orthonormal normalization', () => {
      const signal = createSineWave(1000, 0.1, 48000);
      const result = stft(signal, 48000, {
        fftSize: 2048,
        normalize: 'ortho'
      });

      // Ortho normalizationではエネルギーが1/sqrt(N)でスケール
      const maxMag = Math.max(...(result.magnitude[0] ?? new Float32Array()));
      expect(maxMag).toBeGreaterThan(0);
      expect(maxMag).toBeLessThan(50); // 振幅がスケールされている
    });
  });

  describe('Error handling', () => {
    it('should throw error for non-power-of-2 FFT size', () => {
      expect(() => new STFTProcessor(48000, { fftSize: 1000 })).toThrow(
        'FFT size must be a power of 2'
      );
    });

    it('should throw error for window size larger than FFT size', () => {
      expect(
        () =>
          new STFTProcessor(48000, {
            fftSize: 1024,
            windowSize: 2048
          })
      ).toThrow('Window size cannot be larger than FFT size');
    });
  });
});

describe('STFTProcessor', () => {
  it('should process frame correctly', () => {
    const processor = new STFTProcessor(48000, {
      fftSize: 2048,
      windowType: 'hann'
    });

    const frame = createSineWave(1000, 2048 / 48000, 48000);
    const result = processor.processFrame(frame, 48000);

    expect(result.complex.length).toBe(2050); // (1025 bins * 2)
    expect(result.magnitude.length).toBe(1025);
    expect(result.phase.length).toBe(1025);
    expect(result.frequencies.length).toBe(1025);

    // 周波数が正しく計算されているか
    expect(result.frequencies[0]).toBe(0);
    expect(result.frequencies[result.frequencies.length - 1]).toBe(24000);
  });

  it('should get correct configuration', () => {
    const processor = new STFTProcessor(48000, {
      fftSize: 2048,
      windowSize: 1024,
      hopSize: 256
    });

    const config = processor.getConfig();

    expect(config.fftSize).toBe(2048);
    expect(config.windowSize).toBe(1024);
    expect(config.hopSize).toBe(256);
    expect(config.overlapRatio).toBe(0.75);
  });
});

describe('RealtimeSTFTProcessor', () => {
  it('should process chunks in real-time', () => {
    const processor = new RealtimeSTFTProcessor(48000, {
      fftSize: 2048,
      windowSize: 1024,
      hopSize: 512
    });

    const signal = createComplexSignal(48000, 0.5);
    const chunkSize = 4800; // 100ms
    const chunks: Float32Array[] = [];

    // 信号をチャンクに分割
    for (let i = 0; i < signal.length; i += chunkSize) {
      chunks.push(signal.subarray(i, Math.min(i + chunkSize, signal.length)));
    }

    let totalFrames = 0;
    chunks.forEach((chunk) => {
      const result = processor.process(chunk, 48000);
      totalFrames += result.frames.length;
    });

    expect(totalFrames).toBeGreaterThan(0);
  });

  it('should handle buffer correctly', () => {
    const processor = new RealtimeSTFTProcessor(48000, {
      fftSize: 2048,
      windowSize: 1024,
      hopSize: 512
    });

    // 初期状態
    let status = processor.getBufferStatus();
    expect(status.position).toBe(0);
    expect(status.size).toBe(1024);

    // 小さなチャンクを処理
    const smallChunk = new Float32Array(256);
    processor.process(smallChunk, 48000);

    status = processor.getBufferStatus();
    expect(status.position).toBe(256);

    // バッファをリセット
    processor.reset();
    status = processor.getBufferStatus();
    expect(status.position).toBe(0);
  });

  it('should produce frames when buffer is full', () => {
    const processor = new RealtimeSTFTProcessor(48000, {
      fftSize: 2048,
      windowSize: 1024,
      hopSize: 512
    });

    // 1024サンプル（ちょうど1ウィンドウ）を処理
    const chunk = createSineWave(1000, 1024 / 48000, 48000);
    const result = processor.process(chunk, 48000);

    expect(result.frames.length).toBe(1);
    expect(result.frames[0]?.time).toBe(0);

    // 次の512サンプルでもう1フレーム
    const chunk2 = createSineWave(1000, 512 / 48000, 48000);
    const result2 = processor.process(chunk2, 48000);

    expect(result2.frames.length).toBe(1);
    expect(result2.frames[0]?.time).toBe(0); // 2フレーム目の時刻は0（時刻カウントがリセット）
  });

  it('should maintain phase coherence across frames', () => {
    const processor = new RealtimeSTFTProcessor(48000, {
      fftSize: 2048,
      windowSize: 1024,
      hopSize: 512
    });

    // 連続したサイン波
    const signal = createSineWave(1000, 0.1, 48000);
    const chunkSize = 512;

    const phases: number[] = [];
    const targetBin = Math.round((1000 * 2048) / 48000);

    for (let i = 0; i < signal.length - chunkSize; i += chunkSize) {
      const chunk = signal.subarray(i, i + chunkSize);
      const result = processor.process(chunk, 48000);

      result.frames.forEach((frame) => {
        phases.push(frame.phase[targetBin] ?? 0);
      });
    }

    // 位相が連続的に変化しているか確認
    for (let i = 1; i < phases.length; i++) {
      const phaseDiff = (phases[i] ?? 0) - (phases[i - 1] ?? 0);
      const normalizedDiff = ((phaseDiff + Math.PI) % (2 * Math.PI)) - Math.PI;

      // 期待される位相差
      const expectedDiff = (2 * Math.PI * 1000 * 512) / 48000;
      const expectedNormalized = ((expectedDiff + Math.PI) % (2 * Math.PI)) - Math.PI;

      expect(Math.abs(normalizedDiff - expectedNormalized)).toBeLessThan(0.1);
    }
  });
});

describe('Perfect reconstruction', () => {
  it('should achieve perfect reconstruction with proper overlap', () => {
    const original = createComplexSignal(48000, 0.2);

    // 75%オーバーラップ（推奨設定）
    const stftResult = stft(original, 48000, {
      fftSize: 2048,
      windowSize: 2048,
      hopSize: 512,
      windowType: 'hann',
      normalize: 'backward'
    });

    const reconstructed = istft(
      stftResult,
      48000,
      {
        fftSize: 2048,
        windowSize: 2048,
        hopSize: 512,
        windowType: 'hann',
        normalize: 'backward'
      },
      original.length
    );

    // SNR計算
    let signalPower = 0;
    let noisePower = 0;
    const start = 2048;
    const end = original.length - 2048;

    for (let i = start; i < end; i++) {
      signalPower += (original[i] ?? 0) * (original[i] ?? 0);
      const error = (original[i] ?? 0) - (reconstructed[i] ?? 0);
      noisePower += error * error;
    }

    const snr = 10 * Math.log10(signalPower / noisePower);
    expect(snr).toBeGreaterThan(50); // 50dB以上のSNR
  });

  it('should handle edge cases correctly', () => {
    // 短い信号
    const shortSignal = new Float32Array(100);
    shortSignal.fill(0.5);

    const result = stft(shortSignal, 48000, {
      fftSize: 128,
      windowSize: 64,
      hopSize: 32
    });

    expect(result.frameCount).toBeGreaterThan(0);

    // 窓サイズより短い信号
    const tinySignal = new Float32Array(10);
    tinySignal.fill(0.5);

    const tinyResult = stft(tinySignal, 48000, {
      fftSize: 128,
      windowSize: 64,
      hopSize: 32
    });

    expect(tinyResult.frameCount).toBe(0); // フレームが生成されない
  });
});
