// Markdown becomes safe HTML here, once per article, at publish (design D5;
// decision C9). Raw HTML is escaped, and the parser's own link validation
// refuses the dangerous schemes the spec lists, so no separate sanitizer
// runs: the parser never emits an element the Markdown grammar did not make.
import MarkdownIt from "markdown-it";

// One parser per isolate (design D5): creating it is the expensive part, and
// every render afterwards is warm.
const markdown = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
});

/** Renders Markdown source to the HTML a published snapshot stores (D5). */
export function renderMarkdown(source: string): string {
  return markdown.render(source);
}
