import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: '.',
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'uwmd-core': ['@uwmd/core/browser'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
