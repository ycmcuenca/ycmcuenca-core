<script lang="ts">
  import type { EntrySnapshot } from "@ycmcuenca/cms-core";
  import { blockComponents } from "./registry.ts";

  interface Props {
    blocks: EntrySnapshot["blocks"];
  }

  let { blocks }: Props = $props();
</script>

{#each blocks as block, position (position)}
  {@const Block = blockComponents[block.type]}
  <Block {block} />
{/each}
