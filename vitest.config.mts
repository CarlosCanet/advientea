import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["__tests__/unit/**/*.test.ts"]
        }
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["__tests__/integration/**/*.test.ts"],
          globalSetup: ["src/lib/tests/global-setup.ts"],
          setupFiles: ["src/lib/tests/setup.ts"],
          fileParallelism: false,
          maxWorkers: 1
        }
      }
    ]
  },
})