// Small shared helpers for the migration scripts: how a script knows it was
// run directly, and how it reads a required environment variable.
import { fileURLToPath } from "node:url";

/** Whether this module is the process's entry point, not an import. */
export function isMain(importMetaUrl: string): boolean {
  const entry = process.argv[1];
  return entry !== undefined && fileURLToPath(importMetaUrl) === entry;
}

/**
 * Reads a required environment variable, or exits with a clear message naming
 * it (design D4). The message is what a deploy shows when a secret is missing.
 */
export function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    console.error(`${name} is not set.`);
    process.exit(1);
  }
  return value;
}
