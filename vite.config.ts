import { defineConfig } from 'vitest/config';

// base './' so the static build works from any sub-path (GitHub Pages).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022', assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
