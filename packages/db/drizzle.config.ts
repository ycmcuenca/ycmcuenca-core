// drizzle-kit configuration (design D4): the schema is the source of truth,
// and generated SQL lands in ./migrations. Grants live in a custom migration,
// because Drizzle's schema does not model privileges.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
});
