// The `App` parts this package adds (design D9, D6). The augmentations live
// in an ambient file because the lint rules only allow namespace declarations
// in declaration files; `index.ts` and `access.ts` reference this file, so
// they join the type program of every consuming app. The apps declare the
// same properties in `src/app.d.ts` (task 3.1).
declare global {
  namespace App {
    interface Error {
      /** The request id the error page shows (design D9). */
      requestId: string;
    }
    interface Locals {
      /** The verified Access sign-in's email (design D6). */
      accessEmail?: string;
    }
  }
}

export {};
