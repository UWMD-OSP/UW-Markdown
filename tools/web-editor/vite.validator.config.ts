// The zero-install validator page (validator.html). Built separately from the
// editor (`npm run build:validator`, into dist-validator/) so it is not part of
// the editor bundle the site publishes today. Wiring it into the site is a
// launch-day step (docs/launch/agent-discovery/README.md).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: '.',
  base: '/validate/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    outDir: 'dist-validator',
    sourcemap: true,
    rollupOptions: { input: 'validator.html' },
  },
  server: { fs: { allow: ['../..'] } },
});
