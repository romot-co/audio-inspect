import { AudioInspectError } from '../types.js';

/**
 * FFTプロバイダーの種類
 */
export type FFTProviderType = 'webfft' | 'native' | 'custom';

/**
 * FFT結果
 */
export interface FFTResult {
  /** 複素数結果（インターリーブ形式：実部、虚部、実部、虚部...） */
  complex: Float32Array;
  /** 振幅スペクトラム */
  magnitude: Float32Array;
  /** 位相スペクトラム */
  phase: Float32Array;
  /** 周波数ビン（Hz） */
  frequencies: Float32Array;
}

/**
 * FFTプロバイダーのインターフェース
 */
export interface IFFTProvider {
  /** プロバイダー名 */
  readonly name: string;
  /** FFTサイズ */
  readonly size: number;
  /** サンプルレート */
  readonly sampleRate: number;

  /**
   * FFTを実行
   * @param input - 実数入力データ
   * @returns FFT結果
   */
  fft(input: Float32Array): FFTResult;

  /**
   * リソースを解放
   */
  dispose(): void;

  /**
   * プロファイリングを実行（対応している場合）
   */
  profile?(): Promise<void>;
}

/**
 * FFTプロバイダーの設定
 */
export interface FFTProviderConfig {
  /** プロバイダータイプ */
  type: FFTProviderType;
  /** FFTサイズ（2の累乗である必要があります） */
  fftSize: number;
  /** サンプルレート */
  sampleRate: number;
  /** 自動プロファイリングを有効にするか */
  enableProfiling?: boolean;
  /** カスタムプロバイダー（type='custom'の場合） */
  customProvider?: IFFTProvider;
}

// WebFFT型定義
interface WebFFTInstance {
  fft(input: Float32Array): Float32Array;
  profile(): Promise<unknown>;
  dispose(): void;
}

/**
 * WebFFTプロバイダーの実装
 */
class WebFFTProvider implements IFFTProvider {
  private fftInstance: WebFFTInstance | null = null;

  constructor(
    public readonly size: number,
    public readonly sampleRate: number,
    private enableProfiling: boolean = false
  ) {}

  get name(): string {
    return 'WebFFT';
  }

  async initializeWebFFT(): Promise<void> {
    try {
      // Dynamic import to handle module loading
      const webfftModule = await import('webfft');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      const WebFFTConstructor = webfftModule.default as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      this.fftInstance = new WebFFTConstructor(this.size) as WebFFTInstance;

      if (this.enableProfiling && this.fftInstance?.profile) {
        await this.fftInstance.profile();
      }
    } catch (error) {
      throw new AudioInspectError(
        'UNSUPPORTED_FORMAT',
        `WebFFTの初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  fft(input: Float32Array): FFTResult {
    if (!this.fftInstance) {
      throw new AudioInspectError('UNSUPPORTED_FORMAT', 'WebFFTが初期化されていません');
    }

    if (input.length !== this.size) {
      throw new AudioInspectError(
        'INVALID_INPUT',
        `入力サイズが不正です。期待値: ${this.size}, 実際: ${input.length}`
      );
    }

    // WebFFTは複素数入力（インターリーブ形式）を期待するので、実数を複素数に変換
    const complexInput = new Float32Array(this.size * 2);
    for (let i = 0; i < this.size; i++) {
      complexInput[i * 2] = input[i] || 0; // 実部
      complexInput[i * 2 + 1] = 0; // 虚部（0で初期化）
    }

    // FFT実行
    const complexOutput = this.fftInstance.fft(complexInput);

    // 結果を処理
    const magnitude = new Float32Array(this.size / 2 + 1); // 正の周波数のみ
    const phase = new Float32Array(this.size / 2 + 1);
    const frequencies = new Float32Array(this.size / 2 + 1);

    for (let i = 0; i < magnitude.length; i++) {
      const real = complexOutput[i * 2] || 0;
      const imag = complexOutput[i * 2 + 1] || 0;

      magnitude[i] = Math.sqrt(real * real + imag * imag);
      phase[i] = Math.atan2(imag, real);
      frequencies[i] = (i * this.sampleRate) / this.size;
    }

    return {
      complex: complexOutput,
      magnitude,
      phase,
      frequencies
    };
  }

  async profile(): Promise<void> {
    if (!this.fftInstance || !this.fftInstance.profile) {
      throw new AudioInspectError('UNSUPPORTED_FORMAT', 'WebFFTが初期化されていません');
    }

    await this.fftInstance.profile();
  }

  dispose(): void {
    if (this.fftInstance && this.fftInstance.dispose) {
      this.fftInstance.dispose();
      this.fftInstance = null;
    }
  }
}

/**
 * 効率的なネイティブFFTプロバイダー（Cooley-Tukey実装）
 */
class NativeFFTProvider implements IFFTProvider {
  private bitReversalTable!: Uint32Array;
  private twiddleFactorsReal!: Float32Array;
  private twiddleFactorsImag!: Float32Array;

  constructor(
    public readonly size: number,
    public readonly sampleRate: number
  ) {
    if (!this.isPowerOfTwo(size)) {
      throw new AudioInspectError('INVALID_INPUT', 'FFTサイズは2の冪である必要があります');
    }
    this.precomputeTables();
  }

  get name(): string {
    return 'Native FFT (Cooley-Tukey)';
  }

  private isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }

  private precomputeTables(): void {
    // ビット反転テーブルの事前計算
    this.bitReversalTable = new Uint32Array(this.size);
    const bits = Math.log2(this.size);
    for (let i = 0; i < this.size; i++) {
      let reversed = 0;
      for (let j = 0; j < bits; j++) {
        reversed = (reversed << 1) | ((i >> j) & 1);
      }
      this.bitReversalTable[i] = reversed;
    }

    // Twiddle factorsの事前計算
    const halfSize = this.size / 2;
    this.twiddleFactorsReal = new Float32Array(halfSize);
    this.twiddleFactorsImag = new Float32Array(halfSize);
    for (let i = 0; i < halfSize; i++) {
      const angle = (-2 * Math.PI * i) / this.size;
      this.twiddleFactorsReal[i] = Math.cos(angle);
      this.twiddleFactorsImag[i] = Math.sin(angle);
    }
  }

  fft(input: Float32Array): FFTResult {
    if (input.length !== this.size) {
      throw new AudioInspectError(
        'INVALID_INPUT',
        `入力サイズが不正です。期待値: ${this.size}, 実際: ${input.length}`
      );
    }

    // 複素数配列の初期化（ビット反転順）
    const real = new Float32Array(this.size);
    const imag = new Float32Array(this.size);

    for (let i = 0; i < this.size; i++) {
      const reversedIndex = this.bitReversalTable[i];
      if (reversedIndex !== undefined) {
        real[reversedIndex] = input[i] || 0;
        imag[reversedIndex] = 0;
      }
    }

    // Cooley-Tukey FFTアルゴリズム
    for (let stage = 1; stage < this.size; stage *= 2) {
      const stageSize = stage * 2;
      const twiddleStep = this.size / stageSize;

      for (let k = 0; k < this.size; k += stageSize) {
        for (let j = 0; j < stage; j++) {
          const twiddleIndex = j * twiddleStep;
          const wr = this.twiddleFactorsReal[twiddleIndex] || 0;
          const wi = this.twiddleFactorsImag[twiddleIndex] || 0;

          const evenIndex = k + j;
          const oddIndex = k + j + stage;

          const evenReal = real[evenIndex] || 0;
          const evenImag = imag[evenIndex] || 0;
          const oddReal = real[oddIndex] || 0;
          const oddImag = imag[oddIndex] || 0;

          const tempReal = oddReal * wr - oddImag * wi;
          const tempImag = oddReal * wi + oddImag * wr;

          real[evenIndex] = evenReal + tempReal;
          imag[evenIndex] = evenImag + tempImag;
          real[oddIndex] = evenReal - tempReal;
          imag[oddIndex] = evenImag - tempImag;
        }
      }
    }

    // 結果の構築
    const complex = new Float32Array(this.size * 2);
    const magnitude = new Float32Array(this.size / 2 + 1);
    const phase = new Float32Array(this.size / 2 + 1);
    const frequencies = new Float32Array(this.size / 2 + 1);

    for (let i = 0; i < this.size; i++) {
      complex[i * 2] = real[i] || 0;
      complex[i * 2 + 1] = imag[i] || 0;

      if (i <= this.size / 2) {
        const realPart = real[i] || 0;
        const imagPart = imag[i] || 0;
        magnitude[i] = Math.sqrt(realPart * realPart + imagPart * imagPart);
        phase[i] = Math.atan2(imagPart, realPart);
        frequencies[i] = (i * this.sampleRate) / this.size;
      }
    }

    return { complex, magnitude, phase, frequencies };
  }

  dispose(): void {
    // メモリの明示的な解放（必要に応じて）
  }
}

/**
 * FFTプロバイダーファクトリー
 */
export class FFTProviderFactory {
  /**
   * 指定された設定でFFTプロバイダーを作成
   */
  static async createProvider(config: FFTProviderConfig): Promise<IFFTProvider> {
    switch (config.type) {
      case 'webfft': {
        const provider = new WebFFTProvider(
          config.fftSize,
          config.sampleRate,
          config.enableProfiling
        );
        // 初期化を待つ
        await provider.initializeWebFFT();
        return provider;
      }

      case 'native':
        return new NativeFFTProvider(config.fftSize, config.sampleRate);

      case 'custom':
        if (!config.customProvider) {
          throw new AudioInspectError('INVALID_INPUT', 'カスタムプロバイダーが指定されていません');
        }
        return config.customProvider;

      default: {
        const exhaustiveCheck: never = config.type;
        throw new AudioInspectError(
          'UNSUPPORTED_FORMAT',
          `未対応のFFTプロバイダー: ${String(exhaustiveCheck)}`
        );
      }
    }
  }

  /**
   * 利用可能なプロバイダーをリスト
   */
  static getAvailableProviders(): FFTProviderType[] {
    return ['webfft', 'native'];
  }
}
