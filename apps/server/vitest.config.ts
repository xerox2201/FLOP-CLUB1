import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', '../../packages/shared/src/**/*.test.ts'],
    exclude: ['node_modules/**', 'src/test-*.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/test-*.ts',
        'src/deposit-watcher.ts',
        'src/ton.ts',
      ],
    },
  },
});
