import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    environment: "node",
    globals: false,
    testTimeout: 15000,
  },
  resolve: {
    conditions: ["import", "node"],
  },
});
