import { defineConfig } from 'vitest/config';

// Relative asset URLs so the build works under any sub-path (e.g. /mall-action/ on GitHub Pages).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
