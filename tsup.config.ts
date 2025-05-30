import { defineConfig } from 'tsup';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

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
      js: '// audio-inspect - Lightweight yet powerful audio analysis library'
    },
    onSuccess: async () => {
      // AudioInspectProcessor.global.js を core ディレクトリにコピー
      const srcPath = join('dist', 'AudioInspectProcessor.global.js');
      const destPath = join('dist', 'core', 'AudioInspectProcessor.js');
      
      if (existsSync(srcPath)) {
        // ディレクトリを確実に作成
        mkdirSync(dirname(destPath), { recursive: true });
        copyFileSync(srcPath, destPath);
        console.log('✓ Copied AudioInspectProcessor.global.js to dist/core/AudioInspectProcessor.js');
      } else {
        console.warn('⚠ AudioInspectProcessor.global.js not found for copying');
      }
      
      // E2Eテストページをdistにコピー
      const testPageSrc = join('test', 'e2e', 'test-page.html');
      const testPageDest = join('dist', 'test-page.html');
      
      if (existsSync(testPageSrc)) {
        copyFileSync(testPageSrc, testPageDest);
        console.log('✓ Copied test-page.html to dist/');
      }
    }
  },

  // AudioWorkletProcessor専用バンドル（自己完結型）
  {
    entry: { 'AudioInspectProcessor': 'src/core/AudioInspectProcessor.ts' },
    format: ['iife'], // iife形式に変更して自己完結型にする
    target: 'es2022',
    outDir: 'dist',
    platform: 'browser',
    splitting: false,
    treeshake: false,
    dts: false,
    sourcemap: true,
    minify: false,
    // すべての依存関係をバンドルに含める
    noExternal: [/.*/], // すべてをバンドル
    esbuildOptions(options) {
      options.bundle = true;
      options.format = 'iife';
      options.globalName = 'AudioInspectProcessorBundle';
    },
    banner: { 
      js: `/* AudioInspectProcessor - AudioWorklet専用バンドル */
// 自己完結型バンドル - すべての依存関係を含む` 
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