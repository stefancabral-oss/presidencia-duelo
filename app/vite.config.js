import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 5174,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  preview: {
    host: true,
    port: 4174,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        chromas: resolve(import.meta.dirname, "chromas.html"),
      },
    },
  },
});
