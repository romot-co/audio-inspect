# audio-inspect ライブラリ仕様書

## 1. 概要

audio-inspectは、ブラウザとNode.js環境で動作する軽量かつ高機能なオーディオ解析ライブラリです。音声ファイルやリアルタイムストリームから様々な特徴量を抽出し、ビジュアライザーやオーディオ処理アプリケーションの開発を支援します。

### 主な特徴
- **軽量設計**: コアライブラリは3KB以下（gzip圧縮時）
- **シンプルなAPI**: 3つの基本関数で全機能にアクセス
- **型安全**: TypeScriptによる完全な型定義
- **拡張可能**: プラグインシステムによる機能追加
- **高性能**: Web Audio APIとWebAssemblyを活用した最適化
- **クロスプラットフォーム**: ブラウザ/Node.js/Deno対応

## 2. インストール

```bash
# npm
npm install audio-inspect

# yarn
yarn add audio-inspect

# pnpm
pnpm add audio-inspect
```

### CDN経由での利用
```html
<script type="module">
  import { load, analyze } from 'https://cdn.jsdelivr.net/npm/audio-inspect/+esm';
</script>
```

## 3. 基本的な使い方

### 3.1 音声ファイルの解析

```typescript
import { load, analyze } from 'audio-inspect';
import { getPeaks, getRMS, getSpectrum } from 'audio-inspect/features';

// 音声データの読み込み
const audio = await load(audioFile);

// 単一の特徴量を抽出
const peaks = await analyze(audio, getPeaks);

// 複数の特徴量を並列で抽出
const [peaks, rms, spectrum] = await Promise.all([
  analyze(audio, getPeaks),
  analyze(audio, getRMS),
  analyze(audio, getSpectrum)
]);
```

### 3.2 リアルタイム解析

```typescript
import { stream } from 'audio-inspect';
import { getRMS } from 'audio-inspect/features';

// マイクからのリアルタイム解析
const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });

for await (const rmsValue of stream(microphone, getRMS)) {
  console.log('Current RMS:', rmsValue);
  // ビジュアライザーの更新など
}
```

## 4. コアAPI

### 4.1 型定義

```typescript
// 音声ソースの型
type AudioSource = 
  | ArrayBuffer 
  | Blob 
  | File
  | URL 
  | string // URLパス
  | MediaStream 
  | AudioBuffer
  | AudioData;

// 音声データの構造
interface AudioData {
  sampleRate: number;
  channelData: Float32Array[];
  duration: number;
  numberOfChannels: number;
  length: number; // サンプル数
}

// 特徴抽出関数の型
type Feature<T> = (audio: AudioData, options?: any) => T | Promise<T>;

// ストリーミング制御
interface StreamController {
  pause(): void;
  resume(): void;
  stop(): void;
  readonly paused: boolean;
}
```

### 4.2 基本関数

#### `load(source: AudioSource, options?: LoadOptions): Promise<AudioData>`

音声データを読み込み、解析可能な形式に変換します。

```typescript
interface LoadOptions {
  // デコード設定
  sampleRate?: number;        // リサンプリング（デフォルト: 元のサンプルレート）
  channels?: number | 'mono'; // チャンネル数の指定
  normalize?: boolean;        // 正規化（デフォルト: false）
  
  // メモリ最適化
  lazy?: boolean;            // 遅延読み込み（大きなファイル用）
  chunkSize?: number;        // チャンクサイズ（ストリーミング時）
}

// 使用例
const audio = await load(file, {
  sampleRate: 44100,
  channels: 'mono',
  normalize: true
});
```

#### `analyze<T>(audio: AudioData, feature: Feature<T>): Promise<T>`

音声データから特徴量を抽出します。

```typescript
// 基本的な使用
const peaks = await analyze(audio, getPeaks);

// オプション付き
const spectrum = await analyze(audio, (audio) => 
  getSpectrum(audio, { fftSize: 2048 })
);
```

#### `stream<T>(source: AudioSource, feature: Feature<T>, options?: StreamOptions): AsyncIterableIterator<T> & StreamController`

リアルタイムストリーミング解析を行います。

```typescript
interface StreamOptions {
  bufferSize?: number;     // バッファサイズ（デフォルト: 2048）
  hopSize?: number;        // ホップサイズ（デフォルト: bufferSize / 2）
  throttle?: number;       // 更新頻度の制限（ミリ秒）
  windowFunction?: WindowFunction; // 窓関数
}

// 使用例
const controller = stream(microphone, getRMS, {
  bufferSize: 4096,
  throttle: 50 // 50ms間隔で更新
});

// 制御
controller.pause();
setTimeout(() => controller.resume(), 1000);
```

## 5. 組み込み機能

### 5.1 時間領域解析

```typescript
import { 
  getPeaks,      // ピーク検出
  getRMS,        // RMS（実効値）
  getZeroCrossing, // ゼロクロッシング率
  getEnergy,     // エネルギー
  getEnvelope    // エンベロープ
} from 'audio-inspect/features/time';

// ピーク検出（指定数のピークを抽出）
const peaks = await analyze(audio, (audio) => 
  getPeaks(audio, { count: 100, threshold: 0.1 })
);
```

### 5.2 周波数領域解析

```typescript
import {
  getSpectrum,    // スペクトラム
  getFFT,         // FFT結果
  getSpectralCentroid, // スペクトラル重心
  getSpectralRolloff,  // スペクトラルロールオフ
  getMFCC         // MFCC（メル周波数ケプストラム係数）
} from 'audio-inspect/features/frequency';

// スペクトラム解析
const spectrum = await analyze(audio, (audio) =>
  getSpectrum(audio, { 
    fftSize: 2048,
    windowFunction: 'hanning',
    smoothing: 0.8 
  })
);
```

### 5.3 音楽的特徴

```typescript
import {
  getBPM,         // テンポ検出
  getKey,         // キー検出
  getChords,      // コード検出
  getBeats,       // ビート位置
  getOnsets       // オンセット検出
} from 'audio-inspect/features/music';

// BPM検出
const { bpm, confidence } = await analyze(audio, getBPM);
```

### 5.4 統計的特徴

```typescript
import {
  getLoudness,    // ラウドネス（LUFS）
  getDynamicRange, // ダイナミックレンジ
  getCrestFactor  // クレストファクター
} from 'audio-inspect/features/statistics';
```

## 6. 高度な使い方

### 6.1 カスタム特徴の作成

```typescript
// シンプルなカスタム特徴
const getAveragePower: Feature<number> = (audio) => {
  const samples = audio.channelData[0];
  const sum = samples.reduce((acc, val) => acc + val * val, 0);
  return Math.sqrt(sum / samples.length);
};

// 非同期処理を含むカスタム特徴
const getAdvancedFeature: Feature<ComplexResult> = async (audio, options) => {
  // WebAssemblyモジュールの読み込み
  const wasm = await loadWasmModule();
  
  // 重い計算処理
  return wasm.processAudio(audio.channelData[0], options);
};
```

### 6.2 特徴の合成とパイプライン

```typescript
import { pipe, parallel, cache } from 'audio-inspect/utils';

// パイプライン処理
const analyzePipeline = pipe(
  normalize,           // 正規化
  extractPeaks(100),   // ピーク抽出
  smoothPeaks(0.8)     // スムージング
);

// 並列処理
const multiAnalysis = parallel(
  getPeaks,
  getRMS,
  getSpectrum
);

// キャッシュ機能
const cachedBPM = cache(getBPM);
```

### 6.3 ビジュアライザーとの統合

```typescript
// Canvasベースのビジュアライザー
class WaveformVisualizer {
  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  async visualize(audioSource: AudioSource) {
    const controller = stream(audioSource, getPeaks, {
      bufferSize: 1024,
      throttle: 16 // 60fps
    });

    for await (const peaks of controller) {
      this.draw(peaks);
    }
  }

  private draw(peaks: Float32Array) {
    const { width, height } = this.ctx.canvas;
    this.ctx.clearRect(0, 0, width, height);
    
    // 波形描画ロジック
    this.ctx.beginPath();
    peaks.forEach((peak, i) => {
      const x = (i / peaks.length) * width;
      const y = (1 - peak) * height / 2;
      i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
    });
    this.ctx.stroke();
  }
}
```

## 7. パフォーマンス最適化

### 7.1 メモリ管理

```typescript
// 大きなファイルの処理
const audio = await load(largeFile, {
  lazy: true,  // 遅延読み込み
  chunkSize: 1024 * 1024 // 1MBチャンク
});

// 明示的なメモリ解放
audio.dispose?.();
```

### 7.2 Web Worker での処理

```typescript
import { createWorker } from 'audio-inspect/worker';

// ワーカーの作成
const worker = createWorker();

// バックグラウンドで解析
const result = await worker.analyze(audio, getSpectrum);

// ワーカーの終了
worker.terminate();
```

## 8. エラーハンドリング

```typescript
import { AudioInspectError, isAudioInspectError } from 'audio-inspect';

try {
  const audio = await load(source);
} catch (error) {
  if (isAudioInspectError(error)) {
    switch (error.code) {
      case 'DECODE_ERROR':
        console.error('音声のデコードに失敗しました');
        break;
      case 'UNSUPPORTED_FORMAT':
        console.error('サポートされていない形式です');
        break;
      case 'NETWORK_ERROR':
        console.error('ネットワークエラー');
        break;
    }
  }
}
```

## 9. ブラウザ/Node.js固有の機能

### 9.1 ブラウザ環境

```typescript
// Web Audio APIとの統合
import { fromAudioContext } from 'audio-inspect/browser';

const audioContext = new AudioContext();
const source = audioContext.createBufferSource();
const audio = fromAudioContext(source);

// MediaRecorder統合
const recorder = new MediaRecorder(stream);
const audio = await load(recorder);
```

### 9.2 Node.js環境

```typescript
// ファイルシステムとの統合
import { loadFromPath } from 'audio-inspect/node';

const audio = await loadFromPath('./audio.mp3');

// ストリーム処理
import { createReadStream } from 'fs';
const stream = createReadStream('./large-audio.wav');
const audio = await load(stream);
```

## 10. プラグインの作成と公開

```typescript
// プラグインの作成
import { createPlugin } from 'audio-inspect';

export const myPlugin = createPlugin({
  name: 'pitch-detection',
  version: '1.0.0',
  features: {
    getPitch: async (audio, options) => {
      // ピッチ検出ロジック
      return { frequency: 440, note: 'A4', cents: 0 };
    }
  }
});

// 使用
import { getPitch } from '@myorg/audio-inspect-pitch';
const pitch = await analyze(audio, getPitch);
```

## 11. ライセンスとサポート

- ライセンス: MIT
