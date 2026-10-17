# `@ycmcuenca/tsconfig`

Shared TypeScript configuration for every member of the `ycmcuenca-core`
workspace. The package is private and ships JSON only ("just-in-time": nothing
is built, consumers read the files directly).

## `base.json` — the strict baseline

Used by any TypeScript member (apps and packages). It extends nothing, so it
works for both Node and bundler code.

| Option                     | Why it is set                                                                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strict`                   | The workspace is written against `strict` (assumption A2). It turns on the whole family of checks at once: `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, and so on. Without it, most type bugs slip through silently. |
| `noUncheckedIndexedAccess` | `array[i]` and `record[key]` return `T \| undefined` (A2). Almost every bug class at runtime boundaries is "the index was empty", so the extra `undefined` forces the code to handle it.                                            |

## `svelte-app.json` — for SvelteKit applications

Extends `base.json` and nothing else, on purpose. SvelteKit 3 generates an
app-specific tsconfig at `node_modules/$app/tsconfig.json` (via `svelte-kit
sync`) that already sets `module`, `moduleResolution`, `target`,
`verbatimModuleSyntax`, `allowJs`/`checkJs`, `$lib` paths and the generated
route types. Because the generated file is extended last, app-specific values
win, and the only thing this workspace adds to an app is `base.json`'s
strictness. Anything app-level duplicated here would be dead configuration.

## How to consume

```jsonc
// In an app: apps/<name>/tsconfig.json
{
  "extends": ["@ycmcuenca/tsconfig/svelte-app.json", "$app/tsconfig"],
  "include": ["src", "vite.config.ts"],
}
```

```jsonc
// In a package: packages/<name>/tsconfig.json
{
  "extends": "@ycmcuenca/tsconfig/base.json",
}
```
