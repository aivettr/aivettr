import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "./rules-data.js",
        replacement: fileURLToPath(new URL("./dist/rules-data.js", import.meta.url)),
      },
    ],
  },
});
