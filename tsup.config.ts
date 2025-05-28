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
    platform: 'browser',
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
    platform: 'browser',
  },

  // 時間領域解析
  {
    entry: { 'features/time': 'src/features/time.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outDir: 'dist',
    target: 'es2022',
    platform: 'browser',
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
    platform: 'browser',
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
    platform: 'browser',
  },
]); 