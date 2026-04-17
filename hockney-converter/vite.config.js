import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    host: true,       // bind 0.0.0.0 so cloud sandbox previews can reach it
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
