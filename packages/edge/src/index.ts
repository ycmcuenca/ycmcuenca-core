// The shared edge code both apps consume (design D10): security headers, the
// Content Security Policy, structured logging and error handling. The Access
// guard lives at "@ycmcuenca/edge/access".
//
// Relative imports carry their `.ts` extension: the apps' Vite configs load
// this package through Node's ESM loader, which resolves nothing extensionless.
export { createLogger, handleErrorFor } from "./logging.ts";
export type { LogFields, LogLevel, Logger } from "./logging.ts";
export {
  baselineSecurityHeaders,
  cspDirectives,
  securityHeaders,
} from "./headers.ts";
export type { CspSource } from "./headers.ts";
