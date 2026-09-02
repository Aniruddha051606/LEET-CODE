import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The challenge runs in Asia/Kolkata. Tests deliberately run in a *different*
    // timezone so that any accidental reliance on the host clock's local time fails.
    env: { TZ: "UTC" },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
