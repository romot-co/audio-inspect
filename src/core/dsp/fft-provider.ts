import { AudioInspectError } from '../../types.js';

export type FFTProviderType = 'webfft' | 'native' | 'custom';

// Canonical FFT output shape shared by all providers.
export interface FFTResult {
  complex: Float32Array;
  magnitude: Float32Array;
  phase: Float32Array;
  frequencies: Float32Array;
}

// Provider contract for FFT backends.
export interface IFFTProvider {
  readonly name: string;
  readonly size: number;
  readonly sampleRate: number;

  fft(input: Float32Array): FFTResult | Promise<FFTResult>;

  dispose(): void;

  profile?(): Promise<void>;
}

// Factory configuration for constructing an FFT provider.
export interface FFTProviderConfig {
  type: FFTProviderType;
  fftSize: number;
  sampleRate: number;
  enableProfiling?: boolean;
  customProvider?: IFFTProvider;
}


interface WebFFTInstance {
  fft(input: Float32Array): Float32Array;
  profile(): Promise<unknown>;
  dispose(): void;
}

function createFrequencyBins(fftSize: number, sampleRate: number): Float32Array {
  const bins = new Float32Array(fftSize / 2 + 1);
  const resolution = sampleRate / fftSize;
  for (let i = 0; i < bins.length; i++) {
    bins[i] = i * resolution;
  }
  return bins;
}

// WebFFT-backed provider with deferred dynamic module initialization.
class WebFFTProvider implements IFFTProvider {
  private fftInstance: WebFFTInstance | null = null;
  private initializationPromise: Promise<void> | null = null;
  private readonly complexInput: Float32Array;
  private readonly frequencyBins: Float32Array;

  constructor(
    public readonly size: number,
    public readonly sampleRate: number,
    private enableProfiling: boolean = false
  ) {
    this.complexInput = new Float32Array(this.size * 2);
    this.frequencyBins = createFrequencyBins(this.size, this.sampleRate);
    this.initializationPromise = this.initializeWebFFT();
  }

  get name(): string {
    return 'WebFFT';
  }

  async waitForInitialization(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
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
        `Failed to initialize WebFFT: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async fft(input: Float32Array): Promise<FFTResult> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }

    if (!this.fftInstance) {
      throw new AudioInspectError('UNSUPPORTED_FORMAT', 'WebFFT initialization failed');
    }

    if (input.length !== this.size) {
      throw new AudioInspectError(
        'INVALID_INPUT',
        `Invalid input size. Expected: ${this.size}, Actual: ${input.length}`
      );
    }

    // Convert real input to interleaved complex input (imaginary part = 0).
    for (let i = 0; i < this.size; i++) {
      this.complexInput[i * 2] = input[i]!;
      this.complexInput[i * 2 + 1] = 0;
    }

    const complexOutput = this.fftInstance.fft(this.complexInput);

    // Convert complex output to magnitude/phase for non-negative frequencies.
    const magnitude = new Float32Array(this.size / 2 + 1);
    const phase = new Float32Array(this.size / 2 + 1);

    for (let i = 0; i < magnitude.length; i++) {
      const real = complexOutput[i * 2]!;
      const imag = complexOutput[i * 2 + 1]!;

      magnitude[i] = Math.sqrt(real * real + imag * imag);
      phase[i] = Math.atan2(imag, real);
    }

    return {
      complex: complexOutput,
      magnitude,
      phase,
      frequencies: this.frequencyBins
    };
  }

  async profile(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }

    if (!this.fftInstance || !this.fftInstance.profile) {
      throw new AudioInspectError('UNSUPPORTED_FORMAT', 'WebFFT is not initialized');
    }

    await this.fftInstance.profile();
  }

  dispose(): void {
    if (this.fftInstance) {
      try {
        if (this.fftInstance.dispose) {
          this.fftInstance.dispose();
        }
      } catch (error) {
        console.warn('FFT instance disposal failed:', error);
      } finally {
        this.fftInstance = null;
        this.initializationPromise = null;
      }
    }
  }
}

// In-process Cooley-Tukey FFT provider (radix-2, iterative).
export class NativeFFTProvider implements IFFTProvider {
  private bitReversalTable!: Uint32Array;
  private twiddleFactorsReal!: Float32Array;
  private twiddleFactorsImag!: Float32Array;
  private scratchReal!: Float32Array;
  private scratchImag!: Float32Array;
  private frequencyBins!: Float32Array;

  constructor(
    public readonly size: number,
    public readonly sampleRate: number
  ) {
    if (!this.isPowerOfTwo(size)) {
      throw new AudioInspectError('INVALID_INPUT', 'FFT size must be a power of two');
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
    // Bit-reversal permutation table.
    this.bitReversalTable = new Uint32Array(this.size);
    const bits = Math.log2(this.size);
    for (let i = 0; i < this.size; i++) {
      let reversed = 0;
      for (let j = 0; j < bits; j++) {
        reversed = (reversed << 1) | ((i >> j) & 1);
      }
      this.bitReversalTable[i] = reversed;
    }

    // Twiddle factors for each unique frequency step.
    const halfSize = this.size / 2;
    this.twiddleFactorsReal = new Float32Array(halfSize);
    this.twiddleFactorsImag = new Float32Array(halfSize);
    for (let i = 0; i < halfSize; i++) {
      const angle = (-2 * Math.PI * i) / this.size;
      this.twiddleFactorsReal[i] = Math.cos(angle);
      this.twiddleFactorsImag[i] = Math.sin(angle);
    }

    this.scratchReal = new Float32Array(this.size);
    this.scratchImag = new Float32Array(this.size);
    this.frequencyBins = createFrequencyBins(this.size, this.sampleRate);
  }

  fft(input: Float32Array): FFTResult {
    if (input.length !== this.size) {
      throw new AudioInspectError(
        'INVALID_INPUT',
        `Invalid input size. Expected: ${this.size}, Actual: ${input.length}`
      );
    }

    // Reorder input by bit-reversed indices.
    const real = this.scratchReal;
    const imag = this.scratchImag;

    for (let i = 0; i < this.size; i++) {
      const reversedIndex = this.bitReversalTable[i]!;
      real[reversedIndex] = input[i]!;
      imag[reversedIndex] = 0;
    }

    // Iterative radix-2 butterfly stages.
    for (let stage = 1; stage < this.size; stage *= 2) {
      const stageSize = stage * 2;
      const twiddleStep = this.size / stageSize;

      for (let k = 0; k < this.size; k += stageSize) {
        for (let j = 0; j < stage; j++) {
          const twiddleIndex = j * twiddleStep;
          const wr = this.twiddleFactorsReal[twiddleIndex]!;
          const wi = this.twiddleFactorsImag[twiddleIndex]!;

          const evenIndex = k + j;
          const oddIndex = k + j + stage;

          const evenReal = real[evenIndex]!;
          const evenImag = imag[evenIndex]!;
          const oddReal = real[oddIndex]!;
          const oddImag = imag[oddIndex]!;

          const tempReal = oddReal * wr - oddImag * wi;
          const tempImag = oddReal * wi + oddImag * wr;

          real[evenIndex] = evenReal + tempReal;
          imag[evenIndex] = evenImag + tempImag;
          real[oddIndex] = evenReal - tempReal;
          imag[oddIndex] = evenImag - tempImag;
        }
      }
    }

    // Build complex output and half-spectrum magnitude/phase views.
    const complex = new Float32Array(this.size * 2);
    const magnitude = new Float32Array(this.size / 2 + 1);
    const phase = new Float32Array(this.size / 2 + 1);

    for (let i = 0; i < this.size; i++) {
      complex[i * 2] = real[i]!;
      complex[i * 2 + 1] = imag[i]!;

      if (i <= this.size / 2) {
        const realPart = real[i]!;
        const imagPart = imag[i]!;
        magnitude[i] = Math.sqrt(realPart * realPart + imagPart * imagPart);
        phase[i] = Math.atan2(imagPart, realPart);
      }
    }

    return { complex, magnitude, phase, frequencies: this.frequencyBins };
  }

  dispose(): void {
    this.scratchReal = new Float32Array(0);
    this.scratchImag = new Float32Array(0);
    this.bitReversalTable = new Uint32Array(0);
    this.twiddleFactorsReal = new Float32Array(0);
    this.twiddleFactorsImag = new Float32Array(0);
    this.frequencyBins = new Float32Array(0);
  }
}

export class FFTProviderFactory {
  // Create an FFT provider from config.
  static async createProvider(config: FFTProviderConfig): Promise<IFFTProvider> {
    switch (config.type) {
      case 'webfft': {
        const provider = new WebFFTProvider(
          config.fftSize,
          config.sampleRate,
          config.enableProfiling
        );
        // Ensure WebFFT has loaded before returning.
        await provider.waitForInitialization();
        return provider;
      }

      case 'native':
        return new NativeFFTProvider(config.fftSize, config.sampleRate);

      case 'custom':
        if (!config.customProvider) {
          throw new AudioInspectError('INVALID_INPUT', 'Custom provider is not specified');
        }
        return config.customProvider;

      default: {
        const exhaustiveCheck: never = config.type;
        throw new AudioInspectError(
          'UNSUPPORTED_FORMAT',
          `Unsupported FFT provider: ${String(exhaustiveCheck)}`
        );
      }
    }
  }

  // List built-in providers available in this build.
  static getAvailableProviders(): FFTProviderType[] {
    return ['webfft', 'native'];
  }
}
