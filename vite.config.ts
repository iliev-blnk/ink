import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: () => "ink.js" },
    target: "es2022",
    outDir: "dist",
  },
});
