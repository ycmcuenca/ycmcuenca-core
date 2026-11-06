import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import type { EntrySnapshot } from "@ycmcuenca/cms-core";
import BlockList from "./BlockList.svelte";

describe("BlockList", () => {
  it("renders each markdown block's HTML in order", () => {
    const blocks: EntrySnapshot["blocks"] = [
      { type: "markdown", html: "<p>First paragraph.</p>\n" },
      { type: "markdown", html: "<h2>Second block</h2>\n" },
    ];

    const { body } = render(BlockList, { props: { blocks } });

    expect(body.match(/class="block block-markdown"/g)).toHaveLength(2);
    expect(body).toContain("<p>First paragraph.</p>");
    expect(body).toContain("<h2>Second block</h2>");
    expect(body.indexOf("First paragraph.")).toBeLessThan(
      body.indexOf("Second block"),
    );
  });
});
