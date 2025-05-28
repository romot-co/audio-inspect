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
      external: [],
      output: {
        globals: {}
      }
    }
  },
  
  // テスト設定
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    }
  }
}); 