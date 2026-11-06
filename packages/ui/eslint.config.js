// The workspace's shared Svelte lint rules, because this package holds
// components (design D1).
import svelteConfig from "@ycmcuenca/eslint-config/svelte";

export default [
  ...svelteConfig,
  {
    // In a Svelte file, eslint-plugin-svelte parses type annotations but the
    // base config's `no-undef` cannot resolve DOM type names such as
    // `HTMLDivElement`. TypeScript already reports a name it cannot find in
    // the same position, so the rule only adds noise here.
    files: ["**/*.svelte"],
    rules: { "no-undef": "off" },
  },
];
