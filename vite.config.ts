import { defineConfig } from 'vitest/config';

// base './' keeps every asset URL relative so the build works under any sub-path
// (https://user.github.io/mall-action/ ...).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022', sourcemap: false },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
