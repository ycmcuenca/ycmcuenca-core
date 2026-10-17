// @ycmcuenca/eslint-config/svelte — the shared flat config for SvelteKit
// applications. See design D3 and D5 in
// openspec/changes/bootstrap-monorepo/design.md.
import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import base from "./base.js";

export default [
  // The baseline that every workspace member uses.
  ...base,
  // Svelte component parsing plus the plugin's recommended rule set.
  ...svelte.configs.recommended,
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
  ...svelte.configs.prettier,
  // ...and the general ones. Prettier stays the single owner of formatting.
  prettier,
];
