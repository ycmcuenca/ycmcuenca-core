// The cache tags the site's routes advertise and the purger names (design D4).
// A tag reuses the KV key format, so it names exactly what a snapshot write
// changes; slugs are lowercase ASCII, so every tag is printable ASCII as the
// `Cache-Tag` header requires (design D3).
import { entryKey, indexKey } from "./snapshot-keys.ts";

/** The tag of one entry, the same string as its KV key (design D4). */
export function entryTag(type: string, slug: string): string {
  return entryKey(type, slug);
}

/** The tag of one type's index: `index:<type>:<locale>` (design D4). */
export function indexTag(type: string, locale: string): string {
  return indexKey(type, locale);
}

/** The tag of every page that lists a type: `type:<type>` (design D4). */
export function typeTag(type: string): string {
  return `type:${type}`;
}

/** The tag of every page in a locale: `locale:<locale>` (design D4). */
export function localeTag(locale: string): string {
  return `locale:${locale}`;
}
