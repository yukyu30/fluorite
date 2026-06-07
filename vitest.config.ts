import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // `cli.ts` is the executable entrypoint (shebang + `process.exit` glue);
      // its logic lives in `cli-main.ts` (unit-tested) and the bin itself is
      // exercised end-to-end by `test/cli.integration.test.ts`. `types.ts` is
      // type-only and emits no runtime code.
      exclude: ["src/cli.ts", "src/types.ts"],
    },
  },
});
