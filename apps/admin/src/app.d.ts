// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    interface Error {
      // The request id the error page shows; `handleError` sets it from the
      // request's Ray ID (design D9).
      requestId: string;
    }

    interface Locals {
      // The verified Access sign-in's email, set by `accessGuard` after a
      // successful check (design D6). It stays unset in local development,
      // where the guard is skipped.
      accessEmail?: string;
    }

    // interface PageData {}
    // interface PageState {}
  }
}

export {};
