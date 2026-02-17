import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: '.coverage',
      include: [
        'src/hooks/searchSuggestions.ts',
        'src/context/dockSync.ts',
        'src/utils/iconCache.ts',
        'src/utils/imageCompression.ts',
      ],
      thresholds: {
        statements: 30,
        lines: 30,
        functions: 30,
        branches: 20,
      },
    },
  },
});
