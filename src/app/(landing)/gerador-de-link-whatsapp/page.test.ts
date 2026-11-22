import { describe, expect, it } from "bun:test";

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
