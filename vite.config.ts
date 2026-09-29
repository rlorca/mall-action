import { defineConfig } from 'vite';

// Relative asset URLs: the build is served from a sub-path (e.g. /mall-action/fable-5.1/).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
} as any);
