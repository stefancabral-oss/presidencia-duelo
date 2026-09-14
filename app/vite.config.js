import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  define: {
    __POLIMATCH_ASSET_VERSION__: JSON.stringify(process.env.SOURCE_COMMIT || process.env.GITHUB_SHA || Date.now().toString(36)),
  },
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
