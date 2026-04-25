import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  publicDir: "../public",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
  },
  optimizeDeps: {
    include: ["pdf-lib", "pdfjs-dist"],
  },
});
