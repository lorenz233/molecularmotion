import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages hosts this repository below /molecularmotion/.
  base: process.env.GITHUB_ACTIONS === "true" ? "/molecularmotion/" : "/",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
