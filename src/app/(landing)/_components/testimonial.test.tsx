import { describe, expect, it } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { testimonials } from "@/lib/copy/testimonials";

import { Testimonial } from "./testimonial";

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");

describe("Testimonial", () => {
  it("renders each quote verbatim with its attribution", () => {
    const html = renderToStaticMarkup(<Testimonial />);
    for (const t of testimonials) {
      expect(text(html)).toContain(t.quote);
      expect(text(html)).toContain(t.name);
      expect(text(html)).toContain(t.company);
    }
    expect(html.match(/<figure/g)).toHaveLength(testimonials.length);
    expect(html).toContain("<blockquote");
    expect(html).toContain("<figcaption");
  });

  it("renders several entries side by side", () => {
    const second = { id: "second", quote: "Second quote.", name: "Sam Lee", company: "Acme" };
    const html = renderToStaticMarkup(<Testimonial testimonials={[...testimonials, second]} />);
    expect(html.match(/<figure/g)).toHaveLength(testimonials.length + 1);
    expect(html).toContain("md:grid-cols-2");
  });

  it("renders nothing without entries", () => {
    expect(renderToStaticMarkup(<Testimonial testimonials={[]} />)).toBe("");
  });
});
