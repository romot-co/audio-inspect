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
  profile?(): Promise<any>;
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

/**
 * WebFFTプロバイダーの実装
 */
class WebFFTProvider implements IFFTProvider {
  private fftInstance: any;

  constructor(
    public readonly size: number,
    public readonly sampleRate: number,
    private enableProfiling: boolean = false
  ) {
    // 初期化はファクトリーで行う
  }

  get name(): string {
    return 'WebFFT';
  }

  private async initializeWebFFT(): Promise<void> {
    try {
      // Dynamic import to handle module loading
      const WebFFT = (await import('webfft')).default;
      this.fftInstance = new WebFFT(this.size);

      if (this.enableProfiling) {
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

  async profile(): Promise<any> {
    if (!this.fftInstance) {
      throw new AudioInspectError('UNSUPPORTED_FORMAT', 'WebFFTが初期化されていません');
    }

    return this.fftInstance.profile();
  }

  dispose(): void {
    if (this.fftInstance) {
      this.fftInstance.dispose();
      this.fftInstance = null;
    }
  }
}

/**
 * ネイティブFFTプロバイダー（シンプルなDFT実装）
 */
class NativeFFTProvider implements IFFTProvider {
  constructor(
    public readonly size: number,
    public readonly sampleRate: number
  ) {
    if (!this.isPowerOfTwo(size)) {
      throw new AudioInspectError('INVALID_INPUT', 'FFTサイズは2の累乗である必要があります');
    }
  }

  get name(): string {
    return 'Native DFT';
  }

  private isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }

  fft(input: Float32Array): FFTResult {
    if (input.length !== this.size) {
      throw new AudioInspectError(
        'INVALID_INPUT',
        `入力サイズが不正です。期待値: ${this.size}, 実際: ${input.length}`
      );
    }

    // シンプルなDFT実装（教育目的、パフォーマンスは低い）
    const complex = new Float32Array(this.size * 2);
    const magnitude = new Float32Array(this.size / 2 + 1);
    const phase = new Float32Array(this.size / 2 + 1);
    const frequencies = new Float32Array(this.size / 2 + 1);

    for (let k = 0; k < this.size; k++) {
      let realSum = 0;
      let imagSum = 0;

      for (let n = 0; n < this.size; n++) {
        const angle = (-2 * Math.PI * k * n) / this.size;
        realSum += input[n]! * Math.cos(angle);
        imagSum += input[n]! * Math.sin(angle);
      }

      complex[k * 2] = realSum;
      complex[k * 2 + 1] = imagSum;

      // 正の周波数のみ保存
      if (k <= this.size / 2) {
        magnitude[k] = Math.sqrt(realSum * realSum + imagSum * imagSum);
        phase[k] = Math.atan2(imagSum, realSum);
        frequencies[k] = (k * this.sampleRate) / this.size;
      }
    }

    return {
      complex,
      magnitude,
      phase,
      frequencies
    };
  }

  dispose(): void {
    // ネイティブ実装では特に何もしない
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
      case 'webfft':
        const provider = new WebFFTProvider(
          config.fftSize,
          config.sampleRate,
          config.enableProfiling
        );
        // 初期化を待つ
        await (provider as any).initializeWebFFT();
        return provider;

      case 'native':
        return new NativeFFTProvider(config.fftSize, config.sampleRate);

      case 'custom':
        if (!config.customProvider) {
          throw new AudioInspectError('INVALID_INPUT', 'カスタムプロバイダーが指定されていません');
        }
        return config.customProvider;

      default:
        throw new AudioInspectError(
          'UNSUPPORTED_FORMAT',
          `未対応のFFTプロバイダー: ${config.type}`
        );
    }
  }

  /**
   * 利用可能なプロバイダーをリスト
   */
  static getAvailableProviders(): FFTProviderType[] {
    return ['webfft', 'native'];
  }
}
