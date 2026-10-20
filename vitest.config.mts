import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Vite 8 resolves tsconfig `paths` natively; it replaced the vite-tsconfig-paths plugin.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    projects: [
      {
        test: {
          include: ["__tests__/unit/**/*.test.{ts,tsx}"],
          name: "unit",
        },
      },
      {
        test: {
          fileParallelism: false,
          globalSetup: ["src/lib/tests/global-setup.ts"],
          include: ["__tests__/integration/**/*.test.ts"],
          maxWorkers: 1,
          name: "integration",
          setupFiles: ["src/lib/tests/setup.ts"],
        },
      },
    ],
  },
});
