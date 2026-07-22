/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // See tests/setup/server-only-stub.ts for why.
      "server-only": path.resolve(__dirname, "./tests/setup/server-only-stub.ts"),
    },
  },
});
