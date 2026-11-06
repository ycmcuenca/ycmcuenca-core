import { describe, expect, it } from "vitest";
import { renderBody } from "./render-body";

describe("renderBody", () => {
  it("renders one block to the shape a snapshot stores", () => {
    const rendered = renderBody([
      { type: "markdown", source: "# Hello\n\nWorld." },
    ]);

    expect(rendered).toEqual([
      { type: "markdown", html: "<h1>Hello</h1>\n<p>World.</p>\n" },
    ]);
  });

  it("renders every block separately, in the body's order", () => {
    const rendered = renderBody([
      { type: "markdown", source: "First." },
      { type: "markdown", source: "Second." },
    ]);

    expect(rendered.map((block) => block.html)).toEqual([
      "<p>First.</p>\n",
      "<p>Second.</p>\n",
    ]);
  });
});
