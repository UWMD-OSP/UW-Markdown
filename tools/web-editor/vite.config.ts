import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'uwmd-core': ['@uwmd/core/browser'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
