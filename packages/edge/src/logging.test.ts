import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger, handleErrorFor } from "./logging";
import { captureLogLines, eventFor, parsedLines } from "./test-helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createLogger", () => {
  it("writes one JSON line with level, msg, app and requestId", () => {
    const lines = captureLogLines();

    createLogger(
      "welcome",
      eventFor("https://example.com/", { "cf-ray": "8f2a1b3c4d5e6f70-FRA" })
        .request,
    ).info("page served", { path: "/" });

    expect(lines).toHaveLength(1);
    expect(parsedLines(lines)[0]).toEqual({
      level: "info",
      msg: "page served",
      app: "welcome",
      requestId: "8f2a1b3c4d5e6f70-FRA",
      path: "/",
    });
  });

  it("falls back to a local request id when the request has no cf-ray", () => {
    const lines = captureLogLines();

    createLogger("admin", eventFor("https://example.com/").request).warn(
      "something",
    );

    expect(parsedLines(lines)[0]?.requestId).toMatch(/^local-[0-9a-f-]{36}$/);
  });
});

describe("handleErrorFor", () => {
  it("logs one error line with the message and stack of an unexpected error", () => {
    const lines = captureLogLines();

    const result = handleErrorFor("admin")({
      kind: "unknown",
      error: new Error("boom"),
      event: eventFor("https://example.com/", { "cf-ray": "ray-1" }),
    });

    expect(result).toEqual({ message: "Internal Error", requestId: "ray-1" });
    expect(lines).toHaveLength(1);
    expect(parsedLines(lines)[0]).toMatchObject({
      level: "error",
      msg: "unexpected error",
      app: "admin",
      requestId: "ray-1",
      message: "boom",
    });
    expect(parsedLines(lines)[0]?.stack).toContain("boom");
  });

  it("serializes only the message and stack, never what the error carries", () => {
    class LeakyError extends Error {
      headers = { "cf-access-jwt-assertion": "SECRET-TOKEN" };
      cookies = "CF_Authorization=SECRET-COOKIE";
      token = "SECRET-TOKEN";
    }
    const lines = captureLogLines();

    handleErrorFor("admin")({
      kind: "unknown",
      error: new LeakyError("failed"),
      event: eventFor("https://example.com/"),
    });

    const line = lines[0] ?? "";
    expect(line).not.toContain("SECRET-TOKEN");
    expect(line).not.toContain("SECRET-COOKIE");
    expect(line).not.toContain("cf-access-jwt-assertion");
    expect(Object.keys(JSON.parse(line) as object).sort()).toEqual([
      "app",
      "level",
      "message",
      "msg",
      "requestId",
      "stack",
    ]);
  });

  it("logs nothing for a 404 and still returns the request id", () => {
    const lines = captureLogLines();

    const result = handleErrorFor("welcome")({
      kind: "framework",
      error: { status: 404, message: "Not Found" },
      event: eventFor("https://example.com/missing"),
    });

    expect(lines).toEqual([]);
    expect(result).toEqual({ requestId: expect.stringMatching(/^local-/) });
  });
});
