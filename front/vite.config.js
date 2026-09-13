import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        chromas: resolve(import.meta.dirname, "chromas.html"),
      },
    },
  },
});
