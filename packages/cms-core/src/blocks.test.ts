import { describe, expect, it } from "vitest";
import { bodyBlockLimit, bodySchema, markdownBlock } from "./blocks";
import { accepted, firstIssue } from "./test-helpers";

describe("markdownBlock", () => {
  it("accepts a block of Markdown source", () => {
    expect(
      accepted(markdownBlock, { type: "markdown", source: "# Hi" }),
    ).toEqual({ type: "markdown", source: "# Hi" });
  });
});

describe("bodySchema", () => {
  it("accepts one markdown block", () => {
    expect(accepted(bodySchema, [{ type: "markdown", source: "Hi" }])).toEqual([
      { type: "markdown", source: "Hi" },
    ]);
  });

  it("keeps the blocks in the order they arrived", () => {
    const body = [
      { type: "markdown", source: "first" },
      { type: "markdown", source: "second" },
    ];

    expect(accepted(bodySchema, body)).toEqual(body);
  });

  it("rejects an empty body", () => {
    expect(firstIssue(bodySchema, [])?.message).toBe("Add at least one block.");
  });

  it("rejects a block of an unknown type, reporting it on that block", () => {
    expect(
      firstIssue(bodySchema, [{ type: "image", src: "x.png" }]),
    ).toMatchObject({
      message: "Only markdown blocks are supported.",
      path: [0, "type"],
    });
  });

  it("reports a known block's own problem, not the union's", () => {
    expect(
      firstIssue(bodySchema, [{ type: "markdown", source: 7 }])?.path,
    ).toEqual([0, "source"]);
  });

  it("rejects a body that is not a list", () => {
    expect(firstIssue(bodySchema, "not a body")?.message).toBe(
      "Add at least one block.",
    );
  });

  it("rejects a block with no Markdown source", () => {
    expect(firstIssue(bodySchema, [{ type: "markdown" }])).toMatchObject({
      message: "Enter the Markdown source.",
      path: [0, "source"],
    });
  });

  it("accepts a body of exactly the block limit", () => {
    expect(bodySchema.safeParse(markdownBlocks(bodyBlockLimit)).success).toBe(
      true,
    );
  });

  it("rejects one block more, naming the limit", () => {
    expect(
      firstIssue(bodySchema, markdownBlocks(bodyBlockLimit + 1))?.message,
    ).toBe(`Use at most ${bodyBlockLimit} blocks.`);
  });
});

function markdownBlocks(count: number): unknown[] {
  return Array.from({ length: count }, () => ({
    type: "markdown",
    source: "",
  }));
}
