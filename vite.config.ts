import { defineConfig } from "vite";

// The build is served from a sub-path (e.g. https://user.github.io/mall-action/),
// so every asset URL must be relative.
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
