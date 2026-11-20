// Build-time syntax highlighting for docs code blocks. Lives in its own module
// because Turbopack only accepts serializable MDX options, so plugins with
// function options (parseMetaString) are referenced from next.config.js by path.
import rehypeShiki from "@shikijs/rehype";

const TITLE_META = /title="([^"]+)"/;

export default function rehypeCode() {
  return rehypeShiki.call(this, {
    themes: { light: "github-light", dark: "github-dark-default" },
    langs: ["bash", "javascript", "typescript", "python", "json", "http", "csv", "text"],
    defaultColor: "light",
    // ```bash title="cURL" -> <pre title="cURL">, read by the CodeBlock component.
    parseMetaString: (meta) => {
      const title = TITLE_META.exec(meta)?.[1];
      return title ? { title } : {};
    },
  });
}
