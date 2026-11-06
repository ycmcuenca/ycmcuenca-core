// The block registry (design D1): the single place that maps a block type to
// the component that renders it. `admin`'s preview imports the same map, so
// the editor and the public site cannot render a block differently.
import type { Component } from "svelte";
import type { EntrySnapshot } from "@ycmcuenca/cms-core";
import MarkdownBlock from "./MarkdownBlock.svelte";

/** One rendered block, as the projector stored it at publish (design D1). */
export type RenderedBlock = EntrySnapshot["blocks"][number];

/** A block type the read side knows how to render (design D1). */
export type BlockType = RenderedBlock["type"];

/** What every block component receives (design D1). */
export interface BlockProps {
  readonly block: RenderedBlock;
}

/**
 * Every block type and its component. A new member of the block union is a
 * compile error here until it has a component (design D1).
 */
export const blockComponents: Record<BlockType, Component<BlockProps>> = {
  markdown: MarkdownBlock,
};
