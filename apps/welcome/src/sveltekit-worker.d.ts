// The adapter writes `.svelte-kit/cloudflare/_worker.js` at build time and
// ships no types for it. TypeScript refuses an ambient declaration for a
// relative path (TS2436), so the pattern names the built file instead
// (design D1 in openspec/changes/edge-cache/design.md).
declare module "*cloudflare/_worker.js" {
  interface SvelteKitWorker {
    fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
  }

  const worker: SvelteKitWorker;
  export default worker;
}
