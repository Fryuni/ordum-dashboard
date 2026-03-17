import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import path from "node:path";

export default defineConfig({
  plugins: [preact()],
  root: "src/client",
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      // Allow imports from src/common in client code
      "../../gamedata": path.resolve(__dirname, "gamedata"),
    },
  },
  server: {
    port: 4321,
    proxy: {
      // Proxy API and Jita routes to wrangler dev during development
      "/api": "http://localhost:8787",
      "/jita": "http://localhost:8787",
    },
  },
});
