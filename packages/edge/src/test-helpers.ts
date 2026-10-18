// Small fixtures shared by this package's unit tests. Not part of the
// package's exports (see package.json), so it never reaches an app bundle.
import type { RequestEvent } from "@sveltejs/kit";
import { vi } from "vitest";

// The hooks under test read only `event.request` and `event.locals`; the rest
// of a RequestEvent is not part of these fixtures.
export function eventFor(
  url: string,
  headers: Record<string, string> = {},
): RequestEvent {
  return {
    request: new Request(url, { headers }),
    locals: {},
  } as unknown as RequestEvent;
}

/** Silences console.log and returns the lines written to it. */
export function captureLogLines(): string[] {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    lines.push(String(line));
  });
  return lines;
}

export function parsedLines(lines: string[]): Array<Record<string, unknown>> {
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}
