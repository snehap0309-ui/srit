import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/helpers/setup.ts'],
    globalSetup: ['./src/__tests__/helpers/global-setup.ts'],
    exclude: ['**/dist/**', '**/node_modules/**'],
    testTimeout: 90_000,
    hookTimeout: 90_000,
    pool: 'forks',
  },
});
