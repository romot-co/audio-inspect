# audio-inspect

軽量かつ高機能なオーディオ解析ライブラリ（v0.1.1）

## インストール

### GitHubから直接インストール（推奨）

```bash
npm install github:romot-co/audio-inspect
```

### 要件

- Node.js 18以上
- ブラウザ環境（Web Audio API使用）
- ES Modules またはCommonJS対応

### TypeScript対応

このライブラリはTypeScriptで開発され、型定義ファイル（`.d.ts`）が含まれています。
TypeScript、JavaScript、どちらからでも利用可能です：

```typescript
// TypeScript/ES Modules
import { load, analyze, getPeaks } from 'audio-inspect';

// CommonJS (Node.js)
const { load, analyze, getPeaks } = require('audio-inspect');

// 個別インポート（tree-shaking対応）
import { getPeaks } from 'audio-inspect/features/time';
import { getFFT } from 'audio-inspect/features/frequency';
```

## 基本的な使い方

### 時間領域解析

```typescript
import { load, analyze, getPeaks, getWaveform } from 'audio-inspect';

// 音声ファイルを読み込み
const audio = await load('path/to/audio.mp3');

// ピーク検出
const peaks = await analyze(audio, (audio) => 
  getPeaks(audio, { 
    count: 10, 
    threshold: 0.5 
  })
);

// 波形データ取得（60 FPS）
const waveform = getWaveform(audio, {
  framesPerSecond: 60,
  method: 'rms'
});

console.log(waveform.waveform); // 時間軸波形データ
```

### 周波数領域解析

```typescript
import { getFFT, getSpectrum } from 'audio-inspect/features/frequency';

// FFT解析（WebFFTを使用）
const fft = await getFFT(audio, {
  fftSize: 2048,
  windowFunction: 'hann',
  provider: 'webfft'
});

// スペクトラム解析
const spectrum = await getSpectrum(audio, {
  fftSize: 2048,
  minFrequency: 20,
  maxFrequency: 20000,
  decibels: true
});

// スペクトログラム生成
const spectrogram = await getSpectrum(audio, {
  fftSize: 1024,
  timeFrames: 100,
  overlap: 0.75
});

console.log(spectrogram.spectrogram); // 時間 vs 周波数の強度分布
```

### FFTプロバイダーの切り替え

```typescript
import { FFTProviderFactory } from 'audio-inspect/core/fft-provider';

// 利用可能なプロバイダーを確認
const providers = FFTProviderFactory.getAvailableProviders();
console.log(providers); // ['webfft', 'native']

// WebFFT（高速、推奨）
const fftWebFFT = await getFFT(audio, { provider: 'webfft' });

// ネイティブDFT（互換性重視、低速）
const fftNative = await getFFT(audio, { provider: 'native' });

// プロファイリング付きWebFFT
const fftProfiled = await getFFT(audio, { 
  provider: 'webfft', 
  enableProfiling: true 
});
```

## Tree-shaking対応

必要な機能のみをインポートして、バンドルサイズを最適化できます：

```typescript
// 時間領域解析のみ使用
import { getPeaks, getWaveform } from 'audio-inspect/features/time';

// 周波数領域解析のみ使用
import { getFFT, getSpectrum } from 'audio-inspect/features/frequency';

// FFTプロバイダーのみ使用
import { FFTProviderFactory } from 'audio-inspect/core/fft-provider';
```

## 実装状況

### ✅ 実装済み (v0.1.1)
- `load` - 音声ファイルの読み込み（ブラウザ環境）
- `analyze` - 特徴量抽出の基本機能
- **時間領域解析**:
  - `getPeaks` - ピーク検出
  - `getRMS` - RMS（実効値）計算
  - `getZeroCrossing` - ゼロクロッシング率
  - `getWaveform` - 波形データ取得（任意解像度）
- **周波数領域解析**:
  - `getFFT` - FFT分析（WebFFT/ネイティブ切り替え可能）
  - `getSpectrum` - スペクトラム解析
  - スペクトログラム生成

### 🚧 実装予定
- `stream` - リアルタイムストリーミング解析（v0.2.0予定）
- Node.js環境サポート（v0.3.0予定）
- より高度なピッチ検出アルゴリズム
- MFCC（メル周波数ケプストラム係数）
- 音響特徴量解析

## API

### 時間領域解析

#### getWaveform(audio, options?)

任意の解像度で波形データを取得します。

```typescript
const waveform = getWaveform(audio, {
  framesPerSecond: 60,  // 1秒間のフレーム数
  channel: 0,           // 解析チャンネル（-1で全チャンネル平均）
  method: 'rms'         // 'rms' | 'peak' | 'average'
});
```

#### getPeaks(audio, options?)

ピーク検出を行います。

```typescript
const peaks = getPeaks(audio, {
  count: 100,          // 検出するピーク数
  threshold: 0.1,      // 検出閾値
  channel: 0,          // 解析チャンネル
  minDistance: 441     // 最小ピーク間距離
});
```

### 周波数領域解析

#### getFFT(audio, options?)

FFT分析を行います。

```typescript
const fft = await getFFT(audio, {
  fftSize: 2048,               // FFTサイズ（2の累乗）
  windowFunction: 'hann',      // ウィンドウ関数
  channel: 0,                  // 解析チャンネル
  provider: 'webfft',          // FFTプロバイダー
  enableProfiling: false       // プロファイリング有効化
});
```

#### getSpectrum(audio, options?)

スペクトラム解析を行います。

```typescript
const spectrum = await getSpectrum(audio, {
  fftSize: 2048,
  minFrequency: 20,
  maxFrequency: 20000,
  decibels: true,
  timeFrames: 1,        // 1=単一スペクトラム、>1=スペクトログラム
  overlap: 0.5
});
```

## FFTプロバイダー

### WebFFT（推奨）
- [WebFFT](https://github.com/IQEngine/WebFFT)を使用
- 高速なWebAssembly実装
- 自動ベンチマークによる最適化
- プロファイリング機能

### ネイティブDFT
- 純粋なJavaScript実装
- 互換性重視（WebAssemblyが利用できない環境向け）
- 教育目的にも適している

## 既知の制限事項

1. **Node.js環境**: Web Audio APIを使用しているため、音声ファイルのデコードはブラウザ環境のみ対応

2. **ストリーミング**: `stream`関数は未実装

3. **サンプルレート変換**: `LoadOptions`の`sampleRate`オプションは現在機能しません

## 開発

```bash
# 依存関係のインストール
npm install

# テストの実行
npm test

# ビルド
npm run build

# リント
npm run lint

# フォーマット
npm run format
```

## ライセンス

MIT 