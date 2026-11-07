// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { PageSeo } from "#lib/server/seo.js";

declare global {
  namespace App {
    interface Error {
      // The request id the error page shows; `handleError` sets it from the
      // request's Ray ID (design D9).
      requestId: string;
    }

    interface PageData {
      // The canonical URL and description the layout renders in `<svelte:head>`
      // (design D4). Each page's `load` sets it; the error page has none.
      seo?: PageSeo;
    }

    interface Locals {
      // The tags this response names, set by each cacheable page's `load` or
      // `GET` (design D3). `cachePolicy` turns them into the `Cache-Tag`
      // header on a 200; a route that leaves it unset is never cached.
      cacheTags?: string[];
    }

    // interface PageState {}
  }
}

export {};
