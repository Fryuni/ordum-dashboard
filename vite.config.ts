import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import path from "node:path";

export default defineConfig({
  plugins: [preact()],
  root: "src/client",
  envDir: "../../",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      // Allow imports from src/common in client code
      "../../gamedata": path.resolve(__dirname, "gamedata"),
      // Alias react to preact/compat for packages that import react
      // (convex/react, @workos-inc/authkit-react, etc.)
      react: "preact/compat",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
    },
  },
  server: {
    port: 4321,
  },
});
