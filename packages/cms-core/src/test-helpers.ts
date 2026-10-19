// Small fixtures shared by this package's unit tests. Not part of the
// package's exports (see package.json), so it never reaches an app bundle.
import type { z } from "zod";

/** The value a schema accepts, or a thrown error when it rejects it. */
export function accepted(schema: z.ZodType, value: unknown): unknown {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `expected ${JSON.stringify(value)} to be accepted: ${result.error.message}`,
    );
  }
  return result.data;
}

/** The first problem a schema reports for a value, if it reports one. */
export function firstIssue(
  schema: z.ZodType,
  value: unknown,
): { message: string; path: PropertyKey[] } | undefined {
  const result = schema.safeParse(value);
  if (result.success) {
    return undefined;
  }
  const issue = result.error.issues[0];
  return issue === undefined
    ? undefined
    : { message: issue.message, path: issue.path };
}

/**
 * Markdown of exactly `bytes` UTF-8 bytes, mostly in a three-byte character,
 * so a byte count and a character count agree on different lengths.
 */
export function markdownOfBytes(bytes: number): string {
  const whole = Math.floor(bytes / 3);
  return "€".repeat(whole) + "x".repeat(bytes - whole * 3);
}
