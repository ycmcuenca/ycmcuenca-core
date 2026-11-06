// Markdown becomes safe HTML here, once per article, at publish (design D5;
// decision C9). Raw HTML is escaped, and the parser's own link validation
// refuses the dangerous schemes the spec lists, so no separate sanitizer
// runs: the parser never emits an element the Markdown grammar did not make.
import MarkdownIt, { type RendererRule } from "markdown-it";

// One parser per isolate (design D5): creating it is the expensive part, and
// every render afterwards is warm.
const markdown = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
});

// The strict CSP allows no inline style except SvelteKit's announcer (design
// D8), so a table cell's alignment becomes a class the site's stylesheet
// styles. The parser's table rule would otherwise emit `style="text-align:…"`.
const alignmentClass: Readonly<Record<string, string | undefined>> = {
  left: "align-left",
  center: "align-center",
  right: "align-right",
};

const renderAlignedCell: RendererRule = (
  tokens,
  idx,
  options,
  _env,
  renderer,
) => {
  const token = tokens[idx];
  if (token === undefined) {
    return "";
  }
  const style = token.attrGet("style");
  const alignment =
    typeof style === "string"
      ? alignmentClass[style.replace("text-align:", "")]
      : undefined;
  // The tokens are built fresh for each render, so changing them here cannot
  // leak into another article.
  token.attrs = token.attrs?.filter(([name]) => name !== "style") ?? null;
  if (alignment !== undefined) {
    token.attrJoin("class", alignment);
  }
  return renderer.renderToken(tokens, idx, options);
};

markdown.renderer.rules.th_open = renderAlignedCell;
markdown.renderer.rules.td_open = renderAlignedCell;

/** Renders Markdown source to the HTML a published snapshot stores (D5). */
export function renderMarkdown(source: string): string {
  return markdown.render(source);
}
