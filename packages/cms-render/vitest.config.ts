import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// Unit tests are server-side: `svelte/server`'s `render` turns a component into
// the HTML a visitor receives, so no DOM environment is needed (design D1).
export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
