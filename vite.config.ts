import { defineConfig } from 'vitest/config';

// base './' so the static build works under any sub-path (e.g. GitHub Pages /mall-action/)
export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist', assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
