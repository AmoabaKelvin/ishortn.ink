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

  it("shows the role before the company and the logo when given", () => {
    const entry = {
      id: "with-logo",
      quote: "Quote.",
      name: "Chris Lastra",
      role: "Marketing Manager",
      company: "AIRO",
      logo: "/images/customers/airo.svg",
    };
    const html = renderToStaticMarkup(<Testimonial testimonials={[entry]} />);
    expect(text(html)).toContain("Marketing Manager, AIRO");
    expect(html).toMatch(/<img[^>]*src="\/images\/customers\/airo.svg"/);
    expect(html).toMatch(/<img[^>]*alt="AIRO"/);
  });

  it("shows only the company and no image without a role or logo", () => {
    const entry = { id: "plain", quote: "Quote.", name: "Sam Lee", company: "Acme" };
    const html = renderToStaticMarkup(<Testimonial testimonials={[entry]} />);
    expect(text(html)).toContain("Acme");
    expect(text(html)).not.toContain(", Acme");
    expect(html).not.toContain("<img");
  });

  it("renders nothing without entries", () => {
    expect(renderToStaticMarkup(<Testimonial testimonials={[]} />)).toBe("");
  });
});
