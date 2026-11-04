// Integration tests: they run against the database named by DATABASE_URL_TEST
// and need it prepared (`bun run db:prepare`). They share that one database
// and truncate between cases, so they run in a single process.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
