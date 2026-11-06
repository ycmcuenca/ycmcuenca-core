// A body renders the same way at publish and in the editor's preview (design
// D5): this is the one place a block becomes the snapshot's rendered shape, so
// the two can never drift.
import type { Block } from "./blocks.ts";
import { renderMarkdown } from "./render-markdown.ts";

/** One rendered block, as a published snapshot stores it (design D5). */
export interface RenderedBlock {
  readonly type: "markdown";
  readonly html: string;
}

/** Renders every block of a body, in order (design D5). */
export function renderBody(body: readonly Block[]): RenderedBlock[] {
  return body.map(renderBlock);
}

function renderBlock(block: Block): RenderedBlock {
  switch (block.type) {
    case "markdown":
      return { type: "markdown", html: renderMarkdown(block.source) };
    default:
      return unsupported(block.type);
  }
}

// A block type the union gained without a renderer fails to compile, not at
// runtime (design D5).
function unsupported(blockType: never): never {
  throw new Error(
    `No renderer for the block type ${JSON.stringify(blockType)}.`,
  );
}
