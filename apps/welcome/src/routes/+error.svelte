<script lang="ts">
  import type { ErrorProps } from "./$types";

  // The page every failed request renders: the status and the request id
  // that ties it to its log line, never the error's message or stack
  // (design D9, assumption A11).
  let { error }: ErrorProps = $props();
</script>

<h1>{error.status}</h1>
<p>Request ID: {error.requestId}</p>
