import type { PurgeOutcome } from "@ycmcuenca/cms-core";
import { describe, expect, it } from "vitest";
import { cachePurgerFor } from "./cache-purger";
import type { CachePurgeBinding } from "./cache-purger";

// A binding that records the tags it receives and answers with one outcome
// (design D5), so the test sees exactly what admin sends and reports.
class RecordingPurgeBinding implements CachePurgeBinding {
  readonly calls: string[][] = [];
  readonly #outcome: PurgeOutcome;

  constructor(outcome: PurgeOutcome) {
    this.#outcome = outcome;
  }

  purge(tags: string[]): Promise<PurgeOutcome> {
    this.calls.push(tags);
    return Promise.resolve(this.#outcome);
  }
}

// The local failure a named entrypoint produces under `wrangler dev` (task
// 1.2): the binding call rejects instead of returning an outcome.
class ThrowingPurgeBinding implements CachePurgeBinding {
  purge(): Promise<PurgeOutcome> {
    return Promise.reject(
      new Error('Worker does not export an entrypoint named "Site"'),
    );
  }
}

describe("cachePurgerFor", () => {
  it("sends the tags to the binding and reports its outcome", async () => {
    const binding = new RecordingPurgeBinding({ purged: true });

    const outcome = await cachePurgerFor(binding).purge([
      "entry:article:hello-world",
      "index:article:en",
    ]);

    expect(outcome).toEqual({ purged: true });
    expect(binding.calls).toEqual([
      ["entry:article:hello-world", "index:article:en"],
    ]);
  });

  it("turns a thrown binding error into a refusal with its reason", async () => {
    const outcome = await cachePurgerFor(new ThrowingPurgeBinding()).purge([
      "entry:article:hello-world",
    ]);

    expect(outcome).toEqual({
      purged: false,
      reason: 'Worker does not export an entrypoint named "Site"',
    });
  });
});
