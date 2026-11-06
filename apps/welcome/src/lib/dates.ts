// The date form every public page shows (design D3): the UTC calendar day in
// `YYYY-MM-DD`, with no locale formatting until S4. Snapshot times are ISO
// 8601 strings written by the projector's `toISOString`.
export function dateOnly(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}
