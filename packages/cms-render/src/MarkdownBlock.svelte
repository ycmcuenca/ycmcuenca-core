<script lang="ts">
  import type { BlockProps } from "./registry.ts";

  // The HTML was produced by cms-core's renderer with raw HTML disabled, and
  // only `admin` writes the snapshot store, so `{@html}` here is safe
  // (design D1).

  let { block }: BlockProps = $props();
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- the HTML came from cms-core's renderer with raw HTML disabled (design D1) -->
<div class="block block-markdown">{@html block.html}</div>
