import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packagesRoot = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: [
      { find: '@pkg/core', replacement: path.resolve(packagesRoot, 'core/src') },
      { find: '@pkg/core/', replacement: path.resolve(packagesRoot, 'core/src/') },
      { find: '@pkg/meteo-calcs', replacement: path.resolve(packagesRoot, 'meteo-calcs/src') },
      { find: '@pkg/meteo-calcs/', replacement: path.resolve(packagesRoot, 'meteo-calcs/src/') },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
