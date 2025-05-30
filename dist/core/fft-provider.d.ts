/**
 * FFTプロバイダーの種類
 */
type FFTProviderType = 'webfft' | 'native' | 'custom';
/**
 * FFT結果
 */
interface FFTResult {
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
interface IFFTProvider {
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
    fft(input: Float32Array): FFTResult | Promise<FFTResult>;
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
interface FFTProviderConfig {
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
 * FFTプロバイダーファクトリー
 */
declare class FFTProviderFactory {
    /**
     * 指定された設定でFFTプロバイダーを作成
     */
    static createProvider(config: FFTProviderConfig): Promise<IFFTProvider>;
    /**
     * 利用可能なプロバイダーをリスト
     */
    static getAvailableProviders(): FFTProviderType[];
}

export { type FFTProviderConfig, FFTProviderFactory, type FFTProviderType, type FFTResult, type IFFTProvider };
