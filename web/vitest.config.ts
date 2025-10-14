import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: [...configDefaults.exclude, "tests/e2e/**", "e2e/**"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setupTests.ts"],
    css: true,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
