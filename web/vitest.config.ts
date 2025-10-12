import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    globals: true,
    css: true,
    exclude: ["e2e/**"],
    coverage: {
      enabled: false,
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx,js,jsx}"]
    }
  }
});
