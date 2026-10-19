// How the CMS names the versions of the values it stores and publishes. Both
// stored content (design D4) and published snapshots (design D7) carry a
// version, and each reader fails loudly on one it does not support.
/**
 * The version a versioned value declares under `key`, or `undefined` when the
 * value carries none or is not an object.
 */
export function declaredVersion(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key];
}

/** How an error names a version, including one that is absent (D4, D7). */
export function describeVersion(version: unknown): string {
  return version === undefined ? "missing" : String(version);
}
