// Seeds the local KV the `welcome` e2e worker reads (design D5). The tests run
// against the built worker under `wrangler dev`, so the content must already
// be in the store that worker serves. The CLI writes to the same directory as
// the web server (`e2eStateDirectory`), which keeps the e2e state apart from a
// developer's `bun run dev` state.
import { entryKey, indexKey } from "@ycmcuenca/cms-core";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { e2eStateDirectory } from "./environment";
import { articleIndex, futureArticle, publishedArticles } from "./fixtures";

const appDirectory = fileURLToPath(new URL("..", import.meta.url));

// The CLI takes the value as one argument, so each fixture goes in as JSON.
export default function seedSnapshots(): void {
  for (const article of [...publishedArticles, futureArticle]) {
    put(entryKey(article.type, article.slug), article);
  }
  put(indexKey(articleIndex.type, articleIndex.locale), articleIndex);
}

function put(key: string, value: unknown): void {
  const result = spawnSync(
    "bunx",
    [
      "wrangler",
      "kv",
      "key",
      "put",
      key,
      JSON.stringify(value),
      "--local",
      "--persist-to",
      e2eStateDirectory,
      "--binding",
      "SNAPSHOTS",
    ],
    { cwd: appDirectory, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`Seeding ${key} failed: ${result.stderr}`);
  }
}
