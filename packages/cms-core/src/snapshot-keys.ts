// The KV keys the published snapshots live under (design D5). The writer in
// admin and the reader in welcome import these builders, so the two sides
// cannot drift apart.

/** The key of one published entry: `entry:<type>:<slug>` (design D5). */
export function entryKey(type: string, slug: string): string {
  return `entry:${type}:${slug}`;
}

/** The key of one type's published index: `index:<type>:<locale>` (D5). */
export function indexKey(type: string, locale: string): string {
  return `index:${type}:${locale}`;
}
