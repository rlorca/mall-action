import { defineConfig } from 'vitest/config';

// `base: './'` keeps every asset URL relative so the build works from any sub-path
// (e.g. https://user.github.io/mall-action/<folder>/).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022', sourcemap: false },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
