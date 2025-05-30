import { defineConfig } from 'tsup';

export default defineConfig([
  // メインエントリーポイント
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    external: ['webfft'],
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    clean: true,
    banner: {
      js: '// audio-inspect - 軽量かつ高機能なオーディオ解析ライブラリ',
    },
  },

  // features統合エントリー
  {
    entry: { 'features/index': 'src/features/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    external: ['webfft'],
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
  },

  // 時間領域解析
  {
    entry: { 'features/time': 'src/features/time.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
  },

  // 周波数領域解析
  {
    entry: { 'features/frequency': 'src/features/frequency.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    external: ['webfft'],
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
  },

  // ラウドネス解析
  {
    entry: { 'features/loudness': 'src/features/loudness.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    external: ['webfft'],
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
  },

  // スペクトル解析
  {
    entry: { 'features/spectral': 'src/features/spectral.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    external: ['webfft'],
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
  },

  // 音声活動検出
  {
    entry: { 'features/vad': 'src/features/vad.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
  },

  // エネルギー解析
  {
    entry: { 'features/energy': 'src/features/energy.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
  },

  // ダイナミクス解析
  {
    entry: { 'features/dynamics': 'src/features/dynamics.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
  },

  // ステレオ解析
  {
    entry: { 'features/stereo': 'src/features/stereo.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
  },

  // FFTプロバイダー
  {
    entry: { 'core/fft-provider': 'src/core/fft-provider.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    external: ['webfft'],
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
  },
]); 