<script lang="ts">
  import { appName } from "#lib/app-meta.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const count = $derived(
    data.count === 1 ? "1 entry" : `${data.count} entries`,
  );
</script>

<h1>{appName}</h1>
<p>{count}</p>
