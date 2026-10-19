import { describe, expect, it } from "vitest";
import { markdownOfBytes } from "./test-helpers";
import {
  readStoredContent,
  schemaVersion,
  UnsupportedSchemaVersionError,
} from "./stored-content";
import { bodyByteLimit } from "./types/article.ts";

const content = {
  title: "A title",
  summary: "A summary",
  body: [{ type: "markdown", source: "Hi" }],
};

describe("readStoredContent", () => {
  it("returns version 1 content", () => {
    expect(readStoredContent({ schema_v: 1, content })).toEqual({
      schema_v: 1,
      content,
    });
  });

  it("leaves the slug out of a stored revision", () => {
    // The entry row keeps the slug, where it can be unique per type (design
    // D4), so a revision never stores one.
    const stored = readStoredContent({
      schema_v: 1,
      content: { ...content, slug: "a-title" },
    });

    expect(stored.content).not.toHaveProperty("slug");
  });

  it("keeps the body's byte limit", () => {
    const body = [
      { type: "markdown", source: markdownOfBytes(bodyByteLimit + 1) },
    ];

    expect(() =>
      readStoredContent({ schema_v: 1, content: { ...content, body } }),
    ).toThrow("Use at most 32768 bytes of Markdown.");
  });

  it("fails version 7, naming the version it found", () => {
    const read = () => readStoredContent({ schema_v: 7, content });

    expect(read).toThrow(UnsupportedSchemaVersionError);
    expect(read).toThrow("Unsupported schema version: 7.");
  });

  it("fails a value with no version, naming it missing", () => {
    const read = () => readStoredContent({ content });

    expect(read).toThrow(UnsupportedSchemaVersionError);
    expect(read).toThrow("Unsupported schema version: missing.");
  });

  it("fails a value that is not an object", () => {
    expect(() => readStoredContent("not content")).toThrow(
      "Unsupported schema version: missing.",
    );
  });

  it("keeps the version it found on the error", () => {
    try {
      readStoredContent({ schema_v: 7, content });
      expect.unreachable("expected reading version 7 to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedSchemaVersionError);
      expect((error as UnsupportedSchemaVersionError).version).toBe(7);
    }
  });
});

describe("schemaVersion", () => {
  it("is the version the spec states", () => {
    expect(schemaVersion).toBe(1);
  });
});
