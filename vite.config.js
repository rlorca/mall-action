import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  test: { include: ["test/**/*.test.js"], environment: "node", coverage: { reporter: ["text"] } },
});
