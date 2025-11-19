import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@pkg/core': path.resolve(__dirname, '../../packages/core/src'),
      '@pkg/meteo-providers': path.resolve(__dirname, '../../packages/meteo-providers/src'),
      '@pkg/cache': path.resolve(__dirname, '../../packages/cache/src'),
      '@pkg/insight-engine': path.resolve(__dirname, '../../packages/insight-engine/src'),
      '@pkg/meteo-calcs': path.resolve(__dirname, '../../packages/meteo-calcs/src'),
    },
  },
});
