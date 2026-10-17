// @ycmcuenca/eslint-config/svelte — the shared flat config for SvelteKit
// applications. See design D3 and D5 in
// openspec/changes/archive/2026-10-17-bootstrap-monorepo/design.md.
import svelte from "eslint-plugin-svelte";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import base from "./base.js";

// Svelte files the plugin's rule blocks apply to. Its recommended and prettier
// configs leave some blocks without a scope, which would run Svelte rules (and
// their parser-service requirements) on every other file; those blocks are
// restricted here.
const svelteFiles = ["**/*.svelte", "**/*.svelte.js", "**/*.svelte.ts"];

export default defineConfig(
  // The baseline that every workspace member uses.
  ...base,
  // Svelte component parsing plus the plugin's recommended rule set.
  ...svelte.configs.recommended.map((config) =>
    config.files ? config : { ...config, files: svelteFiles },
  ),
  {
    // TypeScript inside Svelte files: `<script lang="ts">` blocks are parsed
    // with typescript-eslint, and .svelte counts as a known extension.
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".svelte"],
      },
    },
  },
  // Svelte-specific rules that would fight Prettier...
  ...svelte.configs.prettier.map((config) =>
    config.files ? config : { ...config, files: svelteFiles },
  ),
  // ...and the general ones. Prettier stays the single owner of formatting.
  prettier,
);
