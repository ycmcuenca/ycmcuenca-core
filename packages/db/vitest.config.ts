// Unit tests: no database, so they run anywhere (developer-workspace spec,
// "Unit tests without a database"). The integration tests, which need the
// prepared database, use vitest.integration.config.ts instead.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/*.integration.test.ts"],
    // This package's behavior is database-bound, so it has no unit tests; the
    // task must still pass with no database available.
    passWithNoTests: true,
  },
});
