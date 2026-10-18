// Structured logging and error handling for both apps (design D9; the
// observability spec). Every line is one JSON object with `level`, `msg`,
// `app` and `requestId`; only the fields a caller passes are added, and no
// helper ever logs headers, cookies or tokens.
import type {} from "./ambient";
import type { HandleServerError } from "@sveltejs/kit/hooks";

export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export interface Logger {
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
}

/**
 * The request's correlation id: the Cloudflare Ray ID when the request came
 * through Cloudflare, otherwise a per-request local id (design D9).
 */
function requestIdFor(request: Request): string {
  return request.headers.get("cf-ray") ?? `local-${crypto.randomUUID()}`;
}

/** A logger bound to one request; see design D9. */
export function createLogger(app: string, request: Request): Logger {
  return loggerFor(app, requestIdFor(request));
}

/** The same logger when the request's id is already known (design D9). */
function loggerFor(app: string, requestId: string): Logger {
  const write = (level: LogLevel, msg: string, fields?: LogFields): void => {
    console.log(JSON.stringify({ level, msg, app, requestId, ...fields }));
  };
  return {
    info: (msg, fields) => write("info", msg, fields),
    warn: (msg, fields) => write("warn", msg, fields),
    error: (msg, fields) => write("error", msg, fields),
  };
}

/** Message and stack of an unexpected error, whatever was thrown (design D9). */
function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

/**
 * The `handleError` hook for one app: logs the unexpected errors with the
 * request's id, and returns that id for the error page (design D9, assumption
 * A11). Expected errors, such as 404s, are not logged.
 */
export function handleErrorFor(app: string): HandleServerError {
  return ({ kind, error, event }) => {
    const requestId = requestIdFor(event.request);
    if (kind !== "unknown") {
      return { requestId };
    }
    loggerFor(app, requestId).error("unexpected error", describeError(error));
    return { message: "Internal Error", requestId };
  };
}
