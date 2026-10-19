import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./render-markdown";

// A heading, emphasis, a list, a code block and a link: the sample the
// "Ordinary Markdown" scenario names (spec: Markdown renders to safe HTML).
const sample = [
  "# Heading",
  "",
  "Some *emphasis* and a [link](https://example.com).",
  "",
  "- one",
  "- two",
  "",
  "```js",
  "const answer = 42;",
  "```",
  "",
].join("\n");

describe("renderMarkdown", () => {
  it("shows a script tag as escaped text", () => {
    const html = renderMarkdown("<script>alert(1)</script>");

    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("shows an event handler as escaped text, with no element", () => {
    const html = renderMarkdown("<img src=x onerror=alert(1)>");

    // The whole line is escaped text: no `img` element exists, so no
    // `onerror` attribute exists either (spec: Event handler in Markdown).
    expect(html).not.toContain("<img");
    expect(html).toBe("<p>&lt;img src=x onerror=alert(1)&gt;</p>\n");
  });

  it("refuses a javascript: address, leaving the source as text", () => {
    const html = renderMarkdown("[x](javascript:alert(1))");

    expect(html).not.toContain("<a ");
    expect(html).toContain("[x](javascript:alert(1))");
  });

  it("refuses a vbscript: or file: address", () => {
    expect(renderMarkdown("[x](vbscript:msgbox(1))")).not.toContain("<a ");
    expect(renderMarkdown("[x](file:///etc/passwd)")).not.toContain("<a ");
  });

  it("refuses a data: address that is not a GIF, PNG, JPEG or WebP image", () => {
    expect(
      renderMarkdown("[x](data:text/html;base64,PHNjcmlwdD4=)"),
    ).not.toContain("<a ");
    expect(
      renderMarkdown("![x](data:image/svg+xml;base64,PHN2Zz4=)"),
    ).not.toContain("<img");
  });

  it("keeps a data: address that is a GIF, PNG, JPEG or WebP image", () => {
    for (const type of ["gif", "png", "jpeg", "webp"]) {
      const address = `data:image/${type};base64,AAAA`;

      expect(renderMarkdown(`![x](${address})`)).toContain(
        `<img src="${address}" alt="x">`,
      );
    }
  });

  it("renders a heading, emphasis, a list, code and a link", () => {
    const html = renderMarkdown(sample);

    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("<em>emphasis</em>");
    expect(html).toContain('<a href="https://example.com">link</a>');
    expect(html).toContain("<li>one</li>");
    expect(html).toContain('<pre><code class="language-js">');
  });

  it("renders the sample to exactly the recorded HTML", () => {
    // The golden output of markdown-it 15.0.3 with html, linkify and
    // typographer off (design D5). An update that changes it shows up here.
    expect(renderMarkdown(sample)).toBe(
      [
        "<h1>Heading</h1>",
        '<p>Some <em>emphasis</em> and a <a href="https://example.com">link</a>.</p>',
        "<ul>",
        "<li>one</li>",
        "<li>two</li>",
        "</ul>",
        '<pre><code class="language-js">const answer = 42;',
        "</code></pre>",
        "",
      ].join("\n"),
    );
  });

  it("renders the same source to the same HTML", () => {
    expect(renderMarkdown(sample)).toBe(renderMarkdown(sample));
  });
});
