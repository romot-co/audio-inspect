import { AudioInspectError } from '../types.js';
import { ensureValidSample } from './utils.js';

/**
 * 窓関数の種類
 */
export type WindowType =
  | 'hann'
  | 'hamming'
  | 'blackman'
  | 'bartlett'
  | 'kaiser'
  | 'tukey'
  | 'rectangular';

/**
 * STFT/iSTFTのオプション
 */
export interface STFTOptions {
  /** FFTサイズ（2の累乗） */
  fftSize?: number;
  /** 窓サイズ（デフォルト: fftSize） */
  windowSize?: number;
  /** ホップサイズ（デフォルト: windowSize / 2） */
  hopSize?: number;
  /** 窓関数の種類 */
  windowType?: WindowType;
  /** Kaiser窓のβパラメータ */
  kaiserBeta?: number;
  /** Tukey窓のαパラメータ（0-1） */
  tukeyAlpha?: number;
  /** ゼロパディングを使用するか */
  zeroPadding?: boolean;
  /** 正規化モード */
  normalize?: 'forward' | 'backward' | 'ortho' | 'none';
}

/**
 * STFTの結果
 */
export interface STFTResult {
  /** 複素スペクトログラム（実部と虚部のインターリーブ） */
  complex: Float32Array[];
  /** 振幅スペクトログラム */
  magnitude: Float32Array[];
  /** 位相スペクトログラム */
  phase: Float32Array[];
  /** 時間フレーム数 */
  frameCount: number;
  /** 周波数ビン数 */
  frequencyBins: number;
  /** フレームの時刻（秒） */
  times: Float32Array;
  /** 周波数ビンの周波数（Hz） */
  frequencies: Float32Array;
}

/**
 * 窓関数を生成
 */
export function generateWindow(
  type: WindowType,
  size: number,
  options: Partial<STFTOptions> = {}
): Float32Array {
  const window = new Float32Array(size);

  switch (type) {
    case 'hann':
      for (let i = 0; i < size; i++) {
        window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
      }
      break;

    case 'hamming':
      for (let i = 0; i < size; i++) {
        window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
      }
      break;

    case 'blackman':
      for (let i = 0; i < size; i++) {
        const a0 = 0.42;
        const a1 = 0.5;
        const a2 = 0.08;
        window[i] =
          a0 -
          a1 * Math.cos((2 * Math.PI * i) / (size - 1)) +
          a2 * Math.cos((4 * Math.PI * i) / (size - 1));
      }
      break;

    case 'bartlett':
      for (let i = 0; i < size; i++) {
        window[i] = 1 - Math.abs((i - (size - 1) / 2) / ((size - 1) / 2));
      }
      break;

    case 'kaiser':
      {
        const beta = options.kaiserBeta ?? 8.6;
        const besselI0Beta = besselI0(beta);
        for (let i = 0; i < size; i++) {
          const x = (2 * i) / (size - 1) - 1;
          window[i] = besselI0(beta * Math.sqrt(1 - x * x)) / besselI0Beta;
        }
      }
      break;

    case 'tukey':
      {
        const alpha = options.tukeyAlpha ?? 0.5;
        const tukeyN = Math.floor((alpha * (size - 1)) / 2);
        for (let i = 0; i < size; i++) {
          if (i < tukeyN) {
            window[i] = 0.5 * (1 + Math.cos(Math.PI * ((2 * i) / (alpha * (size - 1)) - 1)));
          } else if (i > size - 1 - tukeyN) {
            window[i] =
              0.5 * (1 + Math.cos(Math.PI * ((2 * i) / (alpha * (size - 1)) - 2 / alpha + 1)));
          } else {
            window[i] = 1;
          }
        }
      }
      break;

    case 'rectangular':
      window.fill(1);
      break;

    default:
      throw new AudioInspectError('INVALID_INPUT', `Unknown window type: ${type}`);
  }

  return window;
}

/**
 * Modified Bessel function of the first kind, order 0
 * Used for Kaiser window
 */
function besselI0(x: number): number {
  let sum = 1.0;
  let term = 1.0;
  const x2 = (x * x) / 4;

  for (let k = 1; k < 50; k++) {
    term *= x2 / (k * k);
    sum += term;
    if (term < 1e-10 * sum) break;
  }

  return sum;
}

/**
 * Simple FFT implementation for STFT
 * Based on Cooley-Tukey radix-2 decimation-in-time algorithm
 */
class SimpleFFT {
  private size: number;
  private levels: number;
  private cosTable: Float32Array;
  private sinTable: Float32Array;

  constructor(size: number) {
    if (size <= 0 || (size & (size - 1)) !== 0) {
      throw new AudioInspectError('INVALID_INPUT', 'FFT size must be a power of 2');
    }

    this.size = size;
    this.levels = Math.log2(size);

    // Precompute twiddle factors
    this.cosTable = new Float32Array(size / 2);
    this.sinTable = new Float32Array(size / 2);

    for (let i = 0; i < size / 2; i++) {
      const angle = (-2 * Math.PI * i) / size;
      this.cosTable[i] = Math.cos(angle);
      this.sinTable[i] = Math.sin(angle);
    }
  }

  /**
   * Forward FFT
   */
  forward(real: Float32Array, imag: Float32Array): void {
    // Bit reversal
    this.bitReverse(real);
    this.bitReverse(imag);

    // Cooley-Tukey FFT
    for (let level = 1; level <= this.levels; level++) {
      const levelSize = 1 << level;
      const halfLevel = levelSize >> 1;

      for (let k = 0; k < this.size; k += levelSize) {
        for (let j = 0; j < halfLevel; j++) {
          const i = k + j;
          const ii = i + halfLevel;

          const twiddleIndex = j * (this.size / levelSize);
          const tCos = this.cosTable[twiddleIndex] ?? 0;
          const tSin = this.sinTable[twiddleIndex] ?? 0;

          const tmpReal = (real[ii] ?? 0) * tCos - (imag[ii] ?? 0) * tSin;
          const tmpImag = (real[ii] ?? 0) * tSin + (imag[ii] ?? 0) * tCos;

          real[ii] = (real[i] ?? 0) - tmpReal;
          imag[ii] = (imag[i] ?? 0) - tmpImag;
          real[i] = (real[i] ?? 0) + tmpReal;
          imag[i] = (imag[i] ?? 0) + tmpImag;
        }
      }
    }
  }

  /**
   * Inverse FFT
   */
  inverse(real: Float32Array, imag: Float32Array): void {
    // Conjugate
    for (let i = 0; i < this.size; i++) {
      imag[i] = -(imag[i] ?? 0);
    }

    // Forward FFT
    this.forward(real, imag);

    // Conjugate and scale
    const scale = 1.0 / this.size;
    for (let i = 0; i < this.size; i++) {
      real[i] = (real[i] ?? 0) * scale;
      imag[i] = -(imag[i] ?? 0) * scale;
    }
  }

  /**
   * Bit reversal permutation
   */
  private bitReverse(data: Float32Array): void {
    const n = this.size;
    let j = 0;

    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        const temp = data[i] ?? 0;
        data[i] = data[j] ?? 0;
        data[j] = temp;
      }

      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }
  }
}

/**
 * STFTプロセッサクラス
 */
export class STFTProcessor {
  private fft: SimpleFFT;
  private fftSize: number;
  private windowSize: number;
  private hopSize: number;
  private window: Float32Array;
  private normalize: 'forward' | 'backward' | 'ortho' | 'none';

  constructor(_sampleRate: number, options: STFTOptions = {}) {
    this.fftSize = options.fftSize ?? 2048;
    this.windowSize = options.windowSize ?? this.fftSize;
    this.hopSize = options.hopSize ?? Math.floor(this.windowSize / 2);
    this.normalize = options.normalize ?? 'backward';

    // FFTサイズの検証
    if (this.fftSize <= 0 || (this.fftSize & (this.fftSize - 1)) !== 0) {
      throw new AudioInspectError('INVALID_INPUT', 'FFT size must be a power of 2');
    }

    // 窓サイズの検証
    if (this.windowSize > this.fftSize) {
      throw new AudioInspectError('INVALID_INPUT', 'Window size cannot be larger than FFT size');
    }

    // FFTの初期化
    this.fft = new SimpleFFT(this.fftSize);

    // 窓関数の生成
    const windowType = options.windowType ?? 'hann';
    this.window = generateWindow(windowType, this.windowSize, options);
  }

  /**
   * Short-Time Fourier Transform (STFT)
   */
  stft(signal: Float32Array, sampleRate: number): STFTResult {
    const frameCount =
      signal.length >= this.windowSize
        ? Math.floor((signal.length - this.windowSize) / this.hopSize) + 1
        : 0;
    const frequencyBins = Math.floor(this.fftSize / 2) + 1;

    // 結果配列の初期化
    const complex: Float32Array[] = [];
    const magnitude: Float32Array[] = [];
    const phase: Float32Array[] = [];

    // 作業用バッファ
    const realPart = new Float32Array(this.fftSize);
    const imagPart = new Float32Array(this.fftSize);

    // 各フレームを処理
    for (let frameIdx = 0; frameIdx < frameCount; frameIdx++) {
      const startIdx = frameIdx * this.hopSize;

      // バッファをクリア
      realPart.fill(0);
      imagPart.fill(0);

      // 窓関数を適用してフレームをコピー
      for (let i = 0; i < this.windowSize; i++) {
        const sampleIdx = startIdx + i;
        if (sampleIdx < signal.length) {
          realPart[i] = ensureValidSample(signal[sampleIdx] ?? 0) * (this.window[i] ?? 0);
        }
      }

      // FFT実行
      this.fft.forward(realPart, imagPart);

      // 正規化
      let scaleFactor = 1.0;
      if (this.normalize === 'forward') {
        scaleFactor = 1.0 / this.fftSize;
      } else if (this.normalize === 'ortho') {
        scaleFactor = 1.0 / Math.sqrt(this.fftSize);
      }

      // 複素数、振幅、位相の計算
      const frameComplex = new Float32Array(frequencyBins * 2);
      const frameMagnitude = new Float32Array(frequencyBins);
      const framePhase = new Float32Array(frequencyBins);

      for (let k = 0; k < frequencyBins; k++) {
        const real = (realPart[k] ?? 0) * scaleFactor;
        const imag = (imagPart[k] ?? 0) * scaleFactor;

        frameComplex[k * 2] = real;
        frameComplex[k * 2 + 1] = imag;

        frameMagnitude[k] = Math.sqrt(real * real + imag * imag);
        framePhase[k] = Math.atan2(imag, real);
      }

      complex.push(frameComplex);
      magnitude.push(frameMagnitude);
      phase.push(framePhase);
    }

    // 時間と周波数の配列を生成
    const times = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      times[i] = (i * this.hopSize) / sampleRate;
    }

    const frequencies = new Float32Array(frequencyBins);
    for (let k = 0; k < frequencyBins; k++) {
      frequencies[k] = (k * sampleRate) / this.fftSize;
    }

    return {
      complex,
      magnitude,
      phase,
      frameCount,
      frequencyBins,
      times,
      frequencies
    };
  }

  /**
   * Inverse Short-Time Fourier Transform (iSTFT)
   */
  istft(stftResult: STFTResult, targetLength?: number): Float32Array {
    const { complex, frameCount, frequencyBins } = stftResult;

    // 出力信号の長さを計算
    const outputLength = targetLength ?? (frameCount - 1) * this.hopSize + this.windowSize;

    const output = new Float32Array(outputLength);
    const windowSum = new Float32Array(outputLength);

    // 作業用バッファ
    const realPart = new Float32Array(this.fftSize);
    const imagPart = new Float32Array(this.fftSize);

    // 各フレームを処理
    for (let frameIdx = 0; frameIdx < frameCount; frameIdx++) {
      const startIdx = frameIdx * this.hopSize;
      const frameComplex = complex[frameIdx] ?? new Float32Array(0);

      // バッファをクリア
      realPart.fill(0);
      imagPart.fill(0);

      // 複素スペクトルを実部と虚部に分離
      for (let k = 0; k < frequencyBins; k++) {
        realPart[k] = frameComplex[k * 2] ?? 0;
        imagPart[k] = frameComplex[k * 2 + 1] ?? 0;
      }

      // 負の周波数（共役対称）を生成
      for (let k = 1; k < frequencyBins - 1; k++) {
        realPart[this.fftSize - k] = realPart[k] ?? 0;
        imagPart[this.fftSize - k] = -(imagPart[k] ?? 0);
      }

      // 逆FFT
      this.fft.inverse(realPart, imagPart);

      // 正規化
      let scaleFactor = 1.0;
      if (this.normalize === 'backward') {
        // 逆FFTで既に正規化されている
        scaleFactor = 1.0;
      } else if (this.normalize === 'forward') {
        scaleFactor = this.fftSize;
      } else if (this.normalize === 'ortho') {
        scaleFactor = Math.sqrt(this.fftSize);
      }

      // 窓関数を適用して出力にオーバーラップ加算
      for (let i = 0; i < this.windowSize; i++) {
        const outputIdx = startIdx + i;
        if (outputIdx < outputLength) {
          const sample = (realPart[i] ?? 0) * scaleFactor * (this.window[i] ?? 0);
          output[outputIdx] = (output[outputIdx] ?? 0) + sample;
          windowSum[outputIdx] =
            (windowSum[outputIdx] ?? 0) + (this.window[i] ?? 0) * (this.window[i] ?? 0);
        }
      }
    }

    // 窓関数の正規化
    for (let i = 0; i < outputLength; i++) {
      if ((windowSum[i] ?? 0) > 0) {
        output[i] = (output[i] ?? 0) / (windowSum[i] ?? 1);
      }
    }

    return output;
  }

  /**
   * リアルタイムSTFT用のフレーム処理
   */
  processFrame(
    frame: Float32Array,
    sampleRate: number
  ): {
    complex: Float32Array;
    magnitude: Float32Array;
    phase: Float32Array;
    frequencies: Float32Array;
  } {
    if (frame.length !== this.windowSize) {
      throw new AudioInspectError(
        'INVALID_INPUT',
        `Frame size (${frame.length}) must match window size (${this.windowSize})`
      );
    }

    const realPart = new Float32Array(this.fftSize);
    const imagPart = new Float32Array(this.fftSize);

    // 窓関数を適用
    for (let i = 0; i < this.windowSize; i++) {
      realPart[i] = ensureValidSample(frame[i] ?? 0) * (this.window[i] ?? 0);
    }

    // FFT実行
    this.fft.forward(realPart, imagPart);

    // 正規化
    let scaleFactor = 1.0;
    if (this.normalize === 'forward') {
      scaleFactor = 1.0 / this.fftSize;
    } else if (this.normalize === 'ortho') {
      scaleFactor = 1.0 / Math.sqrt(this.fftSize);
    }

    const frequencyBins = Math.floor(this.fftSize / 2) + 1;
    const complex = new Float32Array(frequencyBins * 2);
    const magnitude = new Float32Array(frequencyBins);
    const phase = new Float32Array(frequencyBins);
    const frequencies = new Float32Array(frequencyBins);

    for (let k = 0; k < frequencyBins; k++) {
      const real = (realPart[k] ?? 0) * scaleFactor;
      const imag = (imagPart[k] ?? 0) * scaleFactor;

      complex[k * 2] = real;
      complex[k * 2 + 1] = imag;

      magnitude[k] = Math.sqrt(real * real + imag * imag);
      phase[k] = Math.atan2(imag, real);
      frequencies[k] = (k * sampleRate) / this.fftSize;
    }

    return { complex, magnitude, phase, frequencies };
  }

  /**
   * 設定を取得
   */
  getConfig(): {
    fftSize: number;
    windowSize: number;
    hopSize: number;
    overlapRatio: number;
  } {
    return {
      fftSize: this.fftSize,
      windowSize: this.windowSize,
      hopSize: this.hopSize,
      overlapRatio: 1 - this.hopSize / this.windowSize
    };
  }
}

/**
 * 便利な関数：単一のSTFT実行
 */
export function stft(
  signal: Float32Array,
  sampleRate: number,
  options: STFTOptions = {}
): STFTResult {
  const processor = new STFTProcessor(sampleRate, options);
  return processor.stft(signal, sampleRate);
}

/**
 * 便利な関数：単一のiSTFT実行
 */
export function istft(
  stftResult: STFTResult,
  sampleRate: number,
  options: STFTOptions = {},
  targetLength?: number
): Float32Array {
  const processor = new STFTProcessor(sampleRate, options);
  return processor.istft(stftResult, targetLength);
}

/**
 * リアルタイムSTFTプロセッサ
 */
export class RealtimeSTFTProcessor {
  private processor: STFTProcessor;
  private inputBuffer: Float32Array;
  private bufferPosition: number;
  private windowSize: number;
  private hopSize: number;
  private sampleRate: number;

  constructor(sampleRate: number, options: STFTOptions = {}) {
    this.sampleRate = sampleRate;
    this.processor = new STFTProcessor(sampleRate, options);
    const config = this.processor.getConfig();
    this.windowSize = config.windowSize;
    this.hopSize = config.hopSize;

    // 入力バッファの初期化
    this.inputBuffer = new Float32Array(this.windowSize);
    this.bufferPosition = 0;
  }

  /**
   * オーディオチャンクを処理
   */
  process(
    chunk: Float32Array,
    sampleRate: number
  ): {
    frames: Array<{
      complex: Float32Array;
      magnitude: Float32Array;
      phase: Float32Array;
      frequencies: Float32Array;
      time: number;
    }>;
  } {
    const frames: Array<{
      complex: Float32Array;
      magnitude: Float32Array;
      phase: Float32Array;
      frequencies: Float32Array;
      time: number;
    }> = [];

    let chunkPosition = 0;

    while (chunkPosition < chunk.length) {
      // バッファに追加できるサンプル数
      const samplesToAdd = Math.min(
        chunk.length - chunkPosition,
        this.windowSize - this.bufferPosition
      );

      // バッファにコピー
      this.inputBuffer.set(
        chunk.subarray(chunkPosition, chunkPosition + samplesToAdd),
        this.bufferPosition
      );

      this.bufferPosition += samplesToAdd;
      chunkPosition += samplesToAdd;

      // バッファが満杯になったらフレームを処理
      if (this.bufferPosition >= this.windowSize) {
        const frame = this.processor.processFrame(this.inputBuffer, sampleRate);
        frames.push({
          ...frame,
          time: (frames.length * this.hopSize) / this.sampleRate
        });

        // オーバーラップのためにバッファをシフト
        this.inputBuffer.copyWithin(0, this.hopSize);
        this.bufferPosition = this.windowSize - this.hopSize;
      }
    }

    return { frames };
  }

  /**
   * バッファをリセット
   */
  reset(): void {
    this.inputBuffer.fill(0);
    this.bufferPosition = 0;
  }

  /**
   * 現在のバッファ状態を取得
   */
  getBufferStatus(): { position: number; size: number } {
    return {
      position: this.bufferPosition,
      size: this.windowSize
    };
  }
}
