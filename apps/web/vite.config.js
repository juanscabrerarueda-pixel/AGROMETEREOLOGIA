import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@pkg/core': path.resolve(__dirname, '../../packages/core/src'),
            '@pkg/cache': path.resolve(__dirname, '../../packages/cache/src'),
            '@pkg/insight-engine': path.resolve(__dirname, '../../packages/insight-engine/src'),
            '@pkg/meteo-calcs': path.resolve(__dirname, '../../packages/meteo-calcs/src'),
            '@pkg/meteo-providers': path.resolve(__dirname, '../../packages/meteo-providers/src'),
        },
        preserveSymlinks: true,
    },
    optimizeDeps: {
        exclude: [
            '@pkg/core',
            '@pkg/cache',
            '@pkg/insight-engine',
            '@pkg/meteo-calcs',
            '@pkg/meteo-providers',
        ],
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
});
//# sourceMappingURL=vite.config.js.map