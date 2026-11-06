// The public API of @ycmcuenca/cms-render (design D1): the components that
// turn published snapshots into HTML, the registry that maps a block type to
// its component, and the tolerant snapshot reader.
//
// `package.json` declares the package side-effect free so a client bundle that
// imports only the components drops the reader. Otherwise cms-core's Zod
// schemas reach the browser, and Zod's JIT probe (`new Function`) is reported
// as a Content Security Policy violation on the article page (design D1).
export { default as BlockList } from "./BlockList.svelte";
export { default as MarkdownBlock } from "./MarkdownBlock.svelte";
export { blockComponents } from "./registry.ts";
export type { BlockType, RenderedBlock } from "./registry.ts";
export { readArticle, readArticleIndex } from "./snapshot-reader.ts";
export type {
  SnapshotKeyValueStore,
  SnapshotLogger,
} from "./snapshot-reader.ts";
