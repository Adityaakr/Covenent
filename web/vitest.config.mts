import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // *.test.tsx files render components and opt into jsdom with a `@vitest-environment jsdom` comment
  test: { include: ["src/**/*.test.ts", "src/**/*.test.tsx"], environment: "node", setupFiles: ["./src/test-setup.ts"] },
});
