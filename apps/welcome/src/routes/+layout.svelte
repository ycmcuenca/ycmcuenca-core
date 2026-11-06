<script lang="ts">
  import { page } from "$app/state";
  import favicon from "#lib/assets/favicon.svg";
  import type { LayoutProps } from "./$types";

  let { data, children }: LayoutProps = $props();

  // Each page's load sets the canonical URL and description (design D4). The
  // layout renders them, so every page carries the same head shape; the error
  // page has no page load, so it carries no canonical.
  const seo = $derived(page.data.seo);
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link
    rel="alternate"
    type="application/atom+xml"
    title="Articles feed"
    href={data.feedUrl}
  />
  {#if seo}
    <link rel="canonical" href={seo.canonical} />
    <link rel="alternate" hreflang="en" href={seo.canonical} />
    <link rel="alternate" hreflang="x-default" href={seo.canonical} />
    <meta name="description" content={seo.description} />
  {/if}
</svelte:head>

{@render children()}
