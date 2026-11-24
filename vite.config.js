import { defineConfig } from 'vite';

// Relative base, like the other games: the built dist/ works at
// https://<user>.github.io/Leadlight/, in any subfolder and inside an iframe.
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
