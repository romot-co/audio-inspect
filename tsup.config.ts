import { defineConfig } from 'tsup';
import { copyFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

// 開発時のみソースマップを有効化
const isDev = process.env.NODE_ENV === 'development';

// 重複する.d.ctsファイルを削除するヘルパー関数
const cleanupDuplicateTypes = () => {
  const distDir = 'dist';
  const cleanup = (dir: string) => {
    try {
      const files = readdirSync(join(distDir, dir), { withFileTypes: true });
      for (const file of files) {
        const filePath = join(distDir, dir, file.name);
        if (file.isDirectory()) {
          cleanup(join(dir, file.name));
        } else if (file.name.endsWith('.d.cts')) {
          unlinkSync(filePath);
          console.log(`✓ Removed duplicate type file: ${filePath}`);
        }
      }
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  };
  cleanup('');
};

export default defineConfig([
  // メインエントリーポイント
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    external: ['webfft'],
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    clean: true,
    minify: true, // コードを圧縮
    banner: {
      js: '// audio-inspect - Lightweight yet powerful audio analysis library'
    },
    onSuccess: async () => {
      // 重複する型定義ファイルを削除
      cleanupDuplicateTypes();
      
      // E2Eテストページは開発時のみコピー
      if (isDev) {
        const testPageSrc = join('test', 'e2e', 'test-page.html');
        const testPageDest = join('dist', 'test-page.html');
        
        if (existsSync(testPageSrc)) {
          copyFileSync(testPageSrc, testPageDest);
          console.log('✓ Copied test-page.html to dist/');
        }
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
    treeshake: true,  // 未使用コードを削除
    dts: false,
    sourcemap: false, // AudioWorkletは本番用なのでソースマップ不要
    minify: true,      // 本番用に圧縮
    // すべての依存関係をバンドルに含める
    noExternal: [/.*/], // すべてをバンドル
    esbuildOptions(options) {
      options.bundle = true;
      options.format = 'iife';
      options.globalName = 'AudioInspectProcessorBundle';
      options.footer = {
        js: '// End of AudioInspectProcessor bundle'
      };
    },
    banner: { 
      js: `/* AudioInspectProcessor - AudioWorklet専用バンドル */
// 自己完結型バンドル - すべての依存関係を含む` 
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
    }
  },

  // features統合エントリー
  {
    entry: { 'features/index': 'src/features/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    external: ['webfft'],
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    minify: true,
  },

  // 時間領域解析
  {
    entry: { 'features/time': 'src/features/time.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    minify: true,
  },

  // 周波数領域解析
  {
    entry: { 'features/frequency': 'src/features/frequency.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    external: ['webfft'],
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    minify: true,
  },

  // ラウドネス解析
  {
    entry: { 'features/loudness': 'src/features/loudness.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    external: ['webfft'],
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    minify: true,
  },

  // スペクトル解析
  {
    entry: { 'features/spectral': 'src/features/spectral.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    external: ['webfft'],
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    minify: true,
  },

  // 音声活動検出
  {
    entry: { 'features/vad': 'src/features/vad.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    minify: true,
  },

  // エネルギー解析
  {
    entry: { 'features/energy': 'src/features/energy.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    minify: true,
  },

  // ダイナミクス解析
  {
    entry: { 'features/dynamics': 'src/features/dynamics.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    minify: true,
  },

  // ステレオ解析
  {
    entry: { 'features/stereo': 'src/features/stereo.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    minify: true,
  },

  // FFTプロバイダー
  {
    entry: { 'core/fft-provider': 'src/core/fft-provider.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    external: ['webfft'],
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    minify: true,
  },
]); 