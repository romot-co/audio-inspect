/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  // ビルド設定
  build: {
    target: 'es2022',
    lib: {
      entry: 'src/index.ts',
      name: 'AudioInspect',
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => `audio-inspect.${format}.js`
    },
    rollupOptions: {
      external: ['webfft'],
      output: {
        globals: {
          'webfft': 'WebFFT'
        }
      }
    },
    minify: false,
    sourcemap: true
  },
  
  // テスト設定
  test: {
    environment: 'node',
    globals: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp}/**'
    ],
    setupFiles: ['test/setup.ts'],
    testTimeout: 10000, // 10秒
    hookTimeout: 10000,
    teardownTimeout: 5000,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
        useAtomics: true
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'text-summary'],
      reportsDirectory: 'coverage',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/e2e/**',
        '**/test/**',
        '**/*.config.*',
        '**/*.d.ts'
      ],
      include: ['src/**/*.ts'],
      all: true,
      clean: true,
      thresholds: {
        global: {
          statements: 70,
          branches: 60,
          functions: 70,
          lines: 70
        }
      }
    }
  },

  // 解決設定
  resolve: {
    alias: {
      '@': '/src'
    }
  },

  // プラグイン
  plugins: [],

  // 最適化設定
  optimizeDeps: {
    include: ['webfft']
  }
}); 