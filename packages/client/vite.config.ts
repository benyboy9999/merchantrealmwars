import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Resolve workspace packages from TypeScript source so Vite doesn't
    // need a build step for shared/engine during client dev.
    alias: {
      '@merchant-realms/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@merchant-realms/engine': path.resolve(__dirname, '../../packages/engine/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api':      { target: 'http://localhost:3000', changeOrigin: true, timeout: 5000, proxyTimeout: 5000 },
      '/admin':    { target: 'http://localhost:3000', changeOrigin: true, timeout: 5000, proxyTimeout: 5000 },
      '/socket.io':{ target: 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
});
