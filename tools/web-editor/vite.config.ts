/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: '.',
  base: '/editor/',
  plugins: [react(), tailwindcss()],
  // Pure logic tests (edits.ts / catalog.ts) run in Node by default. Component
  // tests are *.test.tsx and opt into jsdom with a `// @vitest-environment jsdom`
  // docblock, so the fast node suite isn't slowed by a DOM it doesn't need.
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
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
