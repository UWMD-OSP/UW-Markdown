/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: '.',
  base: './',
  plugins: [react(), tailwindcss()],
  // Unit tests run in Node: edits.ts / catalog.ts are pure logic over
  // @uwmd/core/browser with no DOM. Component (jsdom) tests come later (T-003).
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
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
