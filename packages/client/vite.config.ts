import { defineConfig } from 'vite';

export default defineConfig({
  // relative paths so the build also works from a sub-folder or a static host
  base: './',
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    // fonts and small images become data: URIs (some hosts only allow fonts that way)
    assetsInlineLimit: 120_000,
  },
});
