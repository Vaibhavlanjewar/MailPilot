import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  appType: 'spa',
  plugins: [react()],
  // Client and server share one .env at the repo root. Only VITE_* vars are
  // inlined into the bundle, so server secrets in that file stay server-side.
  envDir: path.resolve(__dirname, '..'),
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
      // Mock interview signaling — needs ws:true or Vite won't forward the
      // Upgrade handshake, and the WebSocket connection just hangs.
      '/ws': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
