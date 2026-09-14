import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 5174,
    proxy: { "/api": "http://localhost:3001" },
  },
  preview: {
    host: true,
    port: 4174,
  },
});
