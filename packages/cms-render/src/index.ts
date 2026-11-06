// The public API of @ycmcuenca/cms-render (design D1): the components that
// turn published snapshots into HTML, the registry that maps a block type to
// its component, and the tolerant snapshot reader.
export { default as BlockList } from "./BlockList.svelte";
export { default as MarkdownBlock } from "./MarkdownBlock.svelte";
export { blockComponents } from "./registry.ts";
export type { BlockType, RenderedBlock } from "./registry.ts";
export { readArticle, readArticleIndex } from "./snapshot-reader.ts";
export type {
  SnapshotKeyValueStore,
  SnapshotLogger,
} from "./snapshot-reader.ts";
