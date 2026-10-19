// The block layer of the content model (design D2): a block is one ordered
// piece of a body. Sprint 2 has exactly one block type, `markdown`, and a
// future type is one more member of the union below.
import { z } from "zod";

/** The most blocks one article's body may hold (design D5). */
export const bodyBlockLimit = 200;

/** A piece of Markdown source; the only block type in Sprint 2 (design D2). */
export const markdownBlock = z.object({
  type: z.literal("markdown"),
  source: z.string({ error: "Enter the Markdown source." }),
});

/** The block types a body may hold, in the order the spec lists them. */
export const blockTypes = ["markdown"] as const;

/** The name of a block type. */
export type BlockTypeName = (typeof blockTypes)[number];

/**
 * A body: an ordered list of one to `bodyBlockLimit` blocks, told apart by
 * their `type` (design D2, D5). Every problem, including a body that is not a
 * list or a block of an unknown type, carries the package's own message, so no
 * Zod default text reaches a form (design D3).
 */
export const bodySchema = z
  .array(
    z.discriminatedUnion("type", [markdownBlock], {
      error: "Only markdown blocks are supported.",
    }),
    { error: "Add at least one block." },
  )
  .min(1, "Add at least one block.")
  .max(bodyBlockLimit, `Use at most ${bodyBlockLimit} blocks.`);
