// AudioWorkletGlobalScope interface for type safety
interface AudioWorkletGlobalScopeInterface {
  registerProcessor: (name: string, processorClass: unknown) => void;
  sampleRate: number;
  currentTime: number;
}

declare const AudioWorkletGlobalScope: AudioWorkletGlobalScopeInterface | undefined;
const isAudioWorkletGlobalScope = typeof AudioWorkletGlobalScope !== 'undefined';

import {
  AudioInspectProcessorOptions,
  AudioData,
  AnalysisResultMessage,
  ErrorMessage,
  UpdateOptionsMessage
} from '../types.js';

// 特徴量関数のマップを型安全に作成
import * as features from '../features/index.js';
import {
  getRMS,
  getPeaks,
  getZeroCrossing,
  getWaveform,
  getPeak,
  getPeakAmplitude
} from '../features/time.js';
import { getFFT, getSpectrum } from '../features/frequency.js';
import { getSpectralFeatures, getTimeVaryingSpectralFeatures } from '../features/spectral.js';
import { getEnergy } from '../features/energy.js';
import { getCrestFactor } from '../features/dynamics.js';
import { getStereoAnalysis, getTimeVaryingStereoAnalysis } from '../features/stereo.js';
import { getVAD } from '../features/vad.js';
import { getLUFS } from '../features/loudness.js';

// AudioWorkletProcessorの型定義（ブラウザ環境で利用可能）
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    _outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean;
}

declare const registerProcessor: (name: string, processorClass: unknown) => void;
declare const sampleRate: number;
declare const currentTime: number;

// 型安全な特徴量関数マップ
type FeatureFunction = (audio: AudioData, options?: unknown) => unknown | Promise<unknown>;

// featureMap定義の前に、必要な関数をインライン化または条件付きインポート
let featureMap: Record<string, FeatureFunction> = {};

// 通常環境では導入した関数を使用
try {
  featureMap = {
    // 時間領域の特徴量
    getRMS: getRMS as FeatureFunction,
    getPeaks: getPeaks as FeatureFunction,
    getZeroCrossing: getZeroCrossing as FeatureFunction,
    getWaveform: getWaveform as FeatureFunction,
    getPeak: getPeak as FeatureFunction,
    getPeakAmplitude: getPeakAmplitude as FeatureFunction,

    // 周波数領域の特徴量
    getFFT: getFFT as FeatureFunction,
    getSpectrum: getSpectrum as FeatureFunction,

    // スペクトル特徴量
    getSpectralFeatures: getSpectralFeatures as FeatureFunction,
    getTimeVaryingSpectralFeatures: getTimeVaryingSpectralFeatures as FeatureFunction,

    // エネルギー解析
    getEnergy: getEnergy as FeatureFunction,

    // ダイナミクス解析
    getCrestFactor: getCrestFactor as FeatureFunction,

    // ステレオ解析
    getStereoAnalysis: getStereoAnalysis as FeatureFunction,
    getTimeVaryingStereoAnalysis: getTimeVaryingStereoAnalysis as FeatureFunction,

    // VAD（音声区間検出）
    getVAD: getVAD as FeatureFunction,

    // LUFS（ラウドネス測定）
    getLUFS: getLUFS as FeatureFunction,

    // フォールバック（他の関数も含む）
    ...(features as Record<string, FeatureFunction>)
  };
} catch (error) {
  console.warn('[AudioInspectProcessor] 一部の機能のインポートに失敗、基本機能のみ使用:', error);
  // フォールバック：基本的な機能のみを提供
  featureMap = {
    getRMS: (audio: AudioData) => {
      // getRMSの簡易実装
      const channelData = audio.channelData[0];
      if (!channelData) return 0;

      let sumOfSquares = 0;
      for (let i = 0; i < channelData.length; i++) {
        const sample = channelData[i] || 0;
        sumOfSquares += sample * sample;
      }
      return Math.sqrt(sumOfSquares / channelData.length);
    },
    // 他の基本的な機能も同様に実装
    getPeak: (audio: AudioData) => {
      const channelData = audio.channelData[0];
      if (!channelData) return 0;

      let max = 0;
      for (let i = 0; i < channelData.length; i++) {
        const abs = Math.abs(channelData[i] || 0);
        if (abs > max) max = abs;
      }
      return max;
    }
  };
}

/**
 * AudioWorkletプロセッサー：AudioWorkletスレッドで実行される
 * リアルタイム性を保つため、非同期処理をノンブロッキングで実行
 */
class AudioInspectProcessor extends AudioWorkletProcessor {
  private options: AudioInspectProcessorOptions = {
    featureName: 'getRMS',
    bufferSize: 1024,
    hopSize: 512,
    inputChannelCount: 1
  };
  private buffers: Float32Array[] = [];
  private bufferWritePosition = 0;
  private lastAnalysisPosition = 0;
  private isAnalyzing = false; // 解析実行中フラグ（排他制御）

  constructor(options?: AudioWorkletNodeOptions) {
    super();

    try {
      console.log('[AudioInspectProcessor] 初期化開始', {
        isAudioWorklet: isAudioWorkletGlobalScope,
        options
      });

      this.options = {
        featureName: 'getRMS',
        bufferSize: 1024,
        hopSize: 512,
        inputChannelCount: 1,
        ...((options?.processorOptions as Partial<AudioInspectProcessorOptions>) || {})
      };

      console.log('[AudioInspectProcessor] 設定初期化完了', this.options);

      // buffers配列を初期化時に適切な型で作成
      this.buffers = new Array(this.options.inputChannelCount)
        .fill(null)
        .map(() => new Float32Array(this.options.bufferSize * 2 + 256));

      console.log('[AudioInspectProcessor] バッファ初期化完了', {
        inputChannelCount: this.options.inputChannelCount,
        bufferSize: this.options.bufferSize,
        totalBufferSize: this.options.bufferSize * 2 + 256
      });

      // メッセージハンドラーを設定
      this.port.onmessage = this.handleMessage.bind(this);

      console.log('[AudioInspectProcessor] 初期化完了');
    } catch (error) {
      console.error('[AudioInspectProcessor] 初期化エラー:', error);
      // エラーをメインスレッドに通知
      this.port.postMessage({
        type: 'error',
        message: 'プロセッサー初期化失敗',
        detail: error
      });
    }
  }

  override process(
    inputs: Float32Array[][],
    _outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    console.log('AudioInspectProcessor: process関数呼び出し', {
      inputsLength: inputs.length,
      firstInputLength: inputs[0]?.length || 0,
      firstChannelLength: inputs[0]?.[0]?.length || 0
    });

    const input = inputs[0];
    if (!input || input.length === 0) {
      console.log('AudioInspectProcessor: 入力データなし、スキップ');
      return true;
    }

    try {
      // Add input data to buffer
      this.addToBuffer(input);

      // Check and perform analysis (non-blocking)
      this.checkAndPerformAnalysis();
    } catch (error) {
      console.error('AudioInspectProcessor: process関数でエラー:', error);
      this.sendError('Error occurred during processing', error);
    }

    return true;
  }

  private addToBuffer(input: Float32Array[]): void {
    const frameSize = input[0]?.length || 0;
    if (frameSize === 0) return;

    // 各チャンネルのデータをバッファに追加
    for (
      let channel = 0;
      channel < Math.min(input.length, this.options.inputChannelCount);
      channel++
    ) {
      const channelData = input[channel];
      const buffer = this.buffers[channel];

      if (channelData && buffer) {
        for (let i = 0; i < frameSize; i++) {
          buffer[this.bufferWritePosition + i] = channelData[i] || 0;
        }
      }
    }

    this.bufferWritePosition += frameSize;

    // バッファがオーバーフローしそうな場合は、データを前方にシフト
    // フレームサイズ + マージンを考慮した条件
    const firstBuffer = this.buffers[0];
    if (firstBuffer && this.bufferWritePosition + frameSize > firstBuffer.length) {
      this.shiftBuffers();
    }
  }

  /**
   * Shift buffer data forward to secure space
   * Works as a sliding window
   */
  private shiftBuffers(): void {
    const keepSize = this.options.bufferSize;
    const shiftAmount = this.bufferWritePosition - keepSize;

    if (shiftAmount <= 0) return;

    // バッファオーバーフロー警告を送信
    this.port.postMessage({
      type: 'bufferOverflow',
      details: {
        bufferWritePosition: this.bufferWritePosition,
        bufferSize: this.options.bufferSize,
        timestamp: currentTime
      }
    });

    // 各チャンネルのバッファをシフト
    for (const buffer of this.buffers) {
      buffer.copyWithin(0, shiftAmount, this.bufferWritePosition);
    }

    // 位置を更新
    this.bufferWritePosition = keepSize;
    this.lastAnalysisPosition = Math.max(0, this.lastAnalysisPosition - shiftAmount);
  }

  /**
   * 解析実行の判定（ホップサイズベース）
   */
  private checkAndPerformAnalysis(): void {
    // 既に解析実行中の場合はスキップ（排他制御）
    if (this.isAnalyzing) {
      return;
    }

    // ホップサイズ分の新しいデータが蓄積され、かつバッファサイズ分のデータが利用可能な場合
    const newDataSize = this.bufferWritePosition - this.lastAnalysisPosition;

    // Debug log for buffer status
    console.log('AudioInspectProcessor: バッファ状況チェック', {
      newDataSize,
      hopSize: this.options.hopSize,
      bufferWritePosition: this.bufferWritePosition,
      bufferSize: this.options.bufferSize,
      lastAnalysisPosition: this.lastAnalysisPosition,
      shouldAnalyze:
        newDataSize >= this.options.hopSize && this.bufferWritePosition >= this.options.bufferSize
    });

    if (
      newDataSize >= this.options.hopSize &&
      this.bufferWritePosition >= this.options.bufferSize
    ) {
      console.log('AudioInspectProcessor: 解析実行条件を満たしました、解析開始');

      // 次の解析開始位置を計算（オーバーラップを考慮）
      const nextAnalysisPosition = this.lastAnalysisPosition + this.options.hopSize;
      this.lastAnalysisPosition = nextAnalysisPosition;

      // Execute analysis asynchronously (does not block audio thread)
      this.performAnalysisAsync();
    }
  }

  /**
   * Execute analysis asynchronously (does not block audio thread)
   */
  private performAnalysisAsync(): void {
    // Set exclusive control flag
    this.isAnalyzing = true;

    try {
      // Extract analysis data
      const analysisData = this.extractAnalysisData();

      // 一時的なAudioDataオブジェクトを作成
      const audioData: AudioData = {
        sampleRate: sampleRate,
        channelData: analysisData,
        duration: this.options.bufferSize / sampleRate,
        numberOfChannels: analysisData.length,
        length: this.options.bufferSize
      };

      // Execute corresponding analysis function asynchronously
      this.executeFeatureFunctionAsync(audioData);
    } catch (error) {
      this.isAnalyzing = false;
      this.sendError('Error occurred during analysis processing', error);
    }
  }

  /**
   * 解析データを現在のバッファから抽出
   */
  private extractAnalysisData(): Float32Array[] {
    const startPos = this.bufferWritePosition - this.options.bufferSize;
    const channelData: Float32Array[] = [];

    for (let channel = 0; channel < this.options.inputChannelCount; channel++) {
      const data = new Float32Array(this.options.bufferSize);
      const sourceBuffer = this.buffers[channel];

      if (sourceBuffer) {
        for (let i = 0; i < this.options.bufferSize; i++) {
          data[i] = sourceBuffer[startPos + i] || 0;
        }
      }

      channelData.push(data);
    }

    return channelData;
  }

  /**
   * Execute analysis function asynchronously and handle results or errors
   */
  private executeFeatureFunctionAsync(audioData: AudioData): void {
    console.log('AudioInspectProcessor: 解析関数実行開始', {
      featureName: this.options.featureName,
      audioDataLength: audioData.length,
      numberOfChannels: audioData.numberOfChannels
    });

    const featureFunction = featureMap[this.options.featureName];

    if (!featureFunction || typeof featureFunction !== 'function') {
      console.error('AudioInspectProcessor: 解析関数が見つかりません:', this.options.featureName);
      this.isAnalyzing = false;
      this.sendError(`Unknown analysis function: ${this.options.featureName}`);
      return;
    }

    try {
      // Execute function (supports both sync and async)
      const resultOrPromise = featureFunction(audioData, this.options.featureOptions);

      // プロミスかどうかの型安全なチェック
      const isPromiseLike = (value: unknown): value is Promise<unknown> => {
        return (
          value !== null &&
          typeof value === 'object' &&
          'then' in value &&
          typeof value.then === 'function'
        );
      };

      if (isPromiseLike(resultOrPromise)) {
        // Async result
        console.log('AudioInspectProcessor: 非同期解析関数実行中...');
        resultOrPromise
          .then((result) => {
            console.log('AudioInspectProcessor: 非同期解析完了、結果:', result);
            this.sendResult(result);
            this.isAnalyzing = false;
          })
          .catch((error) => {
            console.error('AudioInspectProcessor: 非同期解析エラー:', error);
            this.sendError('Error occurred during analysis execution', error);
            this.isAnalyzing = false;
          });
      } else {
        // Sync result
        console.log('AudioInspectProcessor: 同期解析完了、結果:', resultOrPromise);
        this.sendResult(resultOrPromise);
        this.isAnalyzing = false;
      }
    } catch (error) {
      console.error('AudioInspectProcessor: 解析関数実行エラー:', error);
      this.isAnalyzing = false;
      this.sendError('Error occurred during analysis execution', error);
    }
  }

  /**
   * Send analysis result to main thread
   */
  private sendResult(data: unknown): void {
    // Debug log for message sending
    console.log('AudioInspectProcessor: 解析結果を送信:', {
      type: 'analysisResult',
      data,
      timestamp: Date.now()
    });

    const message: AnalysisResultMessage = {
      type: 'analysisResult',
      data,
      timestamp: Date.now()
    };

    this.port.postMessage(message);
  }

  /**
   * Send error to main thread
   */
  private sendError(message: string, detail?: unknown): void {
    // Debug log for error sending
    console.log('AudioInspectProcessor: エラーを送信:', {
      type: 'error',
      message,
      detail
    });

    const errorMessage: ErrorMessage = {
      type: 'error',
      message,
      detail
    };

    this.port.postMessage(errorMessage);
  }

  private handleMessage(event: MessageEvent): void {
    const message = event.data as { type: string };

    switch (message.type) {
      case 'updateOptions':
        this.handleUpdateOptions(message as UpdateOptionsMessage);
        break;
      case 'reset':
        this.handleReset();
        break;
      default:
        // exhaustive switchチェック（型安全な未知メッセージ処理）
        console.warn('Unknown message type:', message.type);
        void message; // 未使用変数警告を回避
    }
  }

  /**
   * オプション更新（部分更新をサポート）
   */
  private handleUpdateOptions(message: UpdateOptionsMessage): void {
    const newOptions = { ...this.options, ...message.payload };

    // バッファサイズが変更された場合はバッファを再初期化
    if (
      newOptions.bufferSize !== this.options.bufferSize ||
      newOptions.inputChannelCount !== this.options.inputChannelCount
    ) {
      this.options = newOptions;
      this.reinitializeBuffers();
    } else {
      this.options = newOptions;
    }
  }

  private handleReset(): void {
    this.bufferWritePosition = 0;
    this.lastAnalysisPosition = 0;
    this.isAnalyzing = false; // 解析中フラグもリセット

    // バッファをクリア
    for (const buffer of this.buffers) {
      buffer.fill(0);
    }
  }

  private reinitializeBuffers(): void {
    this.buffers = new Array(this.options.inputChannelCount)
      .fill(null)
      .map(() => new Float32Array(this.options.bufferSize * 2 + 256));

    this.bufferWritePosition = 0;
    this.lastAnalysisPosition = 0;
    this.isAnalyzing = false;
  }
}

// AudioWorkletプロセッサーを登録
registerProcessor('audio-inspect-processor', AudioInspectProcessor);
