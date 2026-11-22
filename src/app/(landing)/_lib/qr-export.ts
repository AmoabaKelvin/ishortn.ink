const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/**
 * A standalone .svg file from the markup of an inline `<svg>`. Inline SVG in HTML doesn't need the
 * namespace, but a file without it opens as plain XML instead of an image.
 */
export const toSvgFile = (markup: string): string => {
  const svg = /^<svg\b[^>]*\sxmlns=/.test(markup)
    ? markup
    : markup.replace(/^<svg\b/, `<svg xmlns="${SVG_NAMESPACE}"`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
};
