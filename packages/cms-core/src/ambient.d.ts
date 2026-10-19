// The one host global this package uses (design D1). The package compiles
// with `lib: ["esnext"]` alone and `types: []`, which keeps the ambient
// surface small and predictable, and `TextEncoder` is not part of
// `lib.esnext`. workerd, Bun and Node all provide it at runtime, so only its
// type is needed.
//
// The package's `tsconfig.json` includes `src`, so this declaration joins the
// package's own check without any module importing it. An app already has
// `TextEncoder` from `lib.dom` or from its generated worker types, where this
// one would collide with it (`TS2300 Duplicate identifier`) in a program that
// does not set `skipLibCheck`, so nothing in the package imports this file.
declare global {
  class TextEncoder {
    encode(input?: string): Uint8Array;
  }
}

export {};
