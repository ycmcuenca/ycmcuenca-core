import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import { cspDirectives } from "@ycmcuenca/edge";
// `vitest/config` re-exports Vite's `defineConfig` and adds the `test` key.
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // The adapter's platform proxy builds a local Hyperdrive binding whenever
  // Vitest starts a Vite server. This app's unit tests never query the
  // database, so a parseable placeholder satisfies Wrangler without a local
  // container, keeping `bun run test` free of any database dependency
  // (developer-workspace spec). The integration and e2e runs use the real
  // local connection string from the environment.
  if (mode === "test") {
    process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??=
      "postgres://127.0.0.1:54329/admin-unit-tests";
  }

  return {
    plugins: [
      sveltekit({
        compilerOptions: {
          // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
          runes: ({ filename }) =>
            filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
        },
        adapter: adapter(),
        // The enforced Content Security Policy (design D8, decision I10). Hash
        // mode keeps the policy identical for every visitor, so a cached page
        // stays valid when Workers Cache arrives (C10).
        csp: { mode: "hash", directives: cspDirectives },
      }),
    ],

    // Keep the database driver out of the SSR bundle: Vite 8 (rolldown) would
    // inline pg's CommonJS and emit createRequire(import.meta.url), which is
    // undefined in workerd (vitejs/vite#20983). Wrangler bundles them instead,
    // and this app declares them so they resolve from its own node_modules.
    ssr: { external: ["pg", "drizzle-orm"] },

    // A4: fixed dev ports (welcome 5173, admin 5174), strictPort so a busy port
    // fails loudly instead of silently moving the server.
    server: {
      port: 5174,
      strictPort: true,
    },

    // Unit tests live next to the source they cover. Playwright's specs in e2e/
    // are a different harness and must not be picked up by Vitest.
    test: {
      include: ["src/**/*.{test,spec}.ts"],
    },
  };
});
