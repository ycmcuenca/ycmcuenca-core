<script lang="ts">
  import { resolve } from "$app/paths";
  import { appName, siteIntroduction } from "#lib/app-meta.js";
  import { dateOnly } from "#lib/dates.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<h1>{appName}</h1>
<p>{siteIntroduction}</p>

{#if data.articles.length === 0}
  <p>No articles yet.</p>
{:else}
  <ul>
    {#each data.articles as article (article.slug)}
      <li>
        <a href={resolve("/en/articles/[slug]", { slug: article.slug })}
          >{article.title}</a
        >
        <time datetime={dateOnly(article.publishedAt)}
          >{dateOnly(article.publishedAt)}</time
        >
        <p>{article.summary}</p>
      </li>
    {/each}
  </ul>
{/if}
