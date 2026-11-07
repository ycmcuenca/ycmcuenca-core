// The CachePurger port on the `WELCOME` service binding (design D5 in
// openspec/changes/edge-cache/design.md). Admin describes the binding through
// a minimal local interface, so neither app depends on the other's sources.
import type { CachePurger, PurgeOutcome } from "@ycmcuenca/cms-core";

/** The part of welcome's `Site` entrypoint the purger calls (design D5). */
export interface CachePurgeBinding {
  purge(tags: string[]): Promise<PurgeOutcome>;
}

/**
 * The purger admin uses, backed by welcome's `Site` entrypoint over RPC
 * (design D5). A thrown binding error becomes a refusal, because the publish
 * it follows already succeeded and only a warning may follow (design D4).
 */
export function cachePurgerFor(binding: CachePurgeBinding): CachePurger {
  return {
    async purge(tags: string[]): Promise<PurgeOutcome> {
      try {
        return await binding.purge(tags);
      } catch (error) {
        return { purged: false, reason: messageOf(error) };
      }
    },
  };
}

// A thrown value's message, whatever was thrown; the reason is logged, never
// the value itself, so no stack or payload reaches the line (design D4, D6).
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
