import { describe, expect, it } from "bun:test";

import nextConfig from "../../../../next.config.js";
import { metadata as enMetadata } from "../whatsapp-link-generator/page";
import { metadata as ptMetadata } from "./page";

// Both language versions of the WhatsApp link generator list the same hreflang set (Google ignores
// alternates that aren't reciprocal), and each one's canonical is itself.
const languages = {
  en: "/whatsapp-link-generator",
  "pt-BR": "/gerador-de-link-whatsapp",
  "x-default": "/whatsapp-link-generator",
};

describe("WhatsApp link generator hreflang", () => {
  it("links the English page to the Portuguese one", () => {
    expect(enMetadata.alternates).toEqual({ canonical: "/whatsapp-link-generator", languages });
  });

  it("links the Portuguese page to the English one", () => {
    expect(ptMetadata.alternates).toEqual({ canonical: "/gerador-de-link-whatsapp", languages });
    expect(ptMetadata.openGraph).toMatchObject({
      url: "/gerador-de-link-whatsapp",
      locale: "pt_BR",
    });
  });
});

describe("WhatsApp link generator Content-Language", () => {
  it("sends pt-BR for the Portuguese page only", async () => {
    const rules = await nextConfig.headers();
    const contentLanguage = rules.filter((rule: { headers: { key: string }[] }) =>
      rule.headers.some((h) => h.key === "Content-Language"),
    );
    expect(contentLanguage).toEqual([
      {
        source: "/gerador-de-link-whatsapp",
        headers: [{ key: "Content-Language", value: "pt-BR" }],
      },
    ]);
  });
});
