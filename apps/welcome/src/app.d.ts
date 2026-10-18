// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    interface Error {
      // The request id the error page shows; `handleError` sets it from the
      // request's Ray ID (design D9).
      requestId: string;
    }

    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
  }
}

export {};
