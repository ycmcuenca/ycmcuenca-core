import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import { cspDirectives } from "@ycmcuenca/edge";
// `vitest/config` re-exports Vite's `defineConfig` and adds the `test` key.
import { defineConfig } from "vitest/config";

export default defineConfig({
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

  // A4: fixed dev ports (welcome 5173, admin 5174), strictPort so a busy port
  // fails loudly instead of silently moving the server.
  server: {
    port: 5173,
    strictPort: true,
  },

  // Unit tests live next to the source they cover. Playwright's specs in e2e/
  // are a different harness and must not be picked up by Vitest.
  test: {
    include: ["src/**/*.{test,spec}.ts"],
  },
});
