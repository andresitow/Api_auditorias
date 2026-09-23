import path from "node:path";
import { defineConfig } from "vitest/config";

// Pruebas unitarias del frontend (solo lógica/comportamiento, no estilos CSS).
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
