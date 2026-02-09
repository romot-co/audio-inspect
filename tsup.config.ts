import { defineConfig } from 'tsup';
import { copyFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

// 開発時のみソースマップを有効化
const isDev = process.env.NODE_ENV === 'development';
// E2Eテスト用フラグ
const isE2ETest = process.env.E2E_TEST === 'true';

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
    // E2Eテスト時はwebfftをバンドルに含める
    external: isE2ETest ? [] : ['webfft'],
    noExternal: isE2ETest ? ['webfft'] : undefined,
    target: 'es2022',
    platform: isE2ETest ? 'browser' : 'neutral',
    splitting: false,
    clean: true,
    minify: !isDev, // 開発時は圧縮しない
    banner: {
      js: '// audio-inspect - Lightweight yet powerful audio analysis library'
    },
    onSuccess: async () => {
      // 重複する型定義ファイルを削除
      cleanupDuplicateTypes();
    }
  },

  // AudioWorkletProcessor専用バンドル（自己完結型）
  {
    entry: { 'AudioInspectProcessor': 'src/core/realtime/processor.ts' },
    format: ['iife'], // iife形式に変更して自己完結型にする
    target: 'es2022',
    outDir: 'dist',
    platform: 'browser',
    splitting: false,
    treeshake: true,  // 未使用コードを削除
    dts: false,
    sourcemap: false, // AudioWorkletは本番用なのでソースマップ不要
    minify: !isDev,      // 開発時は圧縮しない
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
      // AudioInspectProcessor.global.js を core/realtime ディレクトリにコピー
      const srcPath = join('dist', 'AudioInspectProcessor.global.js');
      const destPath = join('dist', 'core', 'realtime', 'processor.js');
      
      if (existsSync(srcPath)) {
        // ディレクトリを確実に作成
        mkdirSync(dirname(destPath), { recursive: true });
        copyFileSync(srcPath, destPath);
        console.log('✓ Copied AudioInspectProcessor.global.js to dist/core/realtime/processor.js');
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
    external: isE2ETest ? [] : ['webfft'],
    noExternal: isE2ETest ? ['webfft'] : undefined,
    target: 'es2022',
    platform: isE2ETest ? 'browser' : 'neutral',
    splitting: false,
    minify: !isDev,
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
    minify: !isDev,
  },

  // 周波数領域解析
  {
    entry: { 'features/frequency': 'src/features/frequency.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    external: isE2ETest ? [] : ['webfft'],
    noExternal: isE2ETest ? ['webfft'] : undefined,
    target: 'es2022',
    platform: isE2ETest ? 'browser' : 'neutral',
    splitting: false,
    minify: !isDev,
  },

  // ラウドネス解析
  {
    entry: { 'features/loudness': 'src/features/loudness.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    external: isE2ETest ? [] : ['webfft'],
    noExternal: isE2ETest ? ['webfft'] : undefined,
    target: 'es2022',
    platform: isE2ETest ? 'browser' : 'neutral',
    splitting: false,
    minify: !isDev,
  },

  // スペクトル解析
  {
    entry: { 'features/spectral': 'src/features/spectral.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    external: isE2ETest ? [] : ['webfft'],
    noExternal: isE2ETest ? ['webfft'] : undefined,
    target: 'es2022',
    platform: isE2ETest ? 'browser' : 'neutral',
    splitting: false,
    minify: !isDev,
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
    minify: !isDev,
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
    minify: !isDev,
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
    minify: !isDev,
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
    minify: !isDev,
  },

  // FFTプロバイダー
  {
    entry: { 'core/dsp/fft-provider': 'src/core/dsp/fft-provider.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    outDir: 'dist',
    external: isE2ETest ? [] : ['webfft'],
    noExternal: isE2ETest ? ['webfft'] : undefined,
    target: 'es2022',
    platform: isE2ETest ? 'browser' : 'neutral',
    splitting: false,
    minify: !isDev,
  },
]); 
