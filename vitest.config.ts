import {defineConfig} from "vitest/config"

export default defineConfig({
  test: {
    // setupFiles: ['./tests/setup.ts'],
    // silent: false,
    fileParallelism: false, // This is the modern way to disable parallel file execution
  },
});