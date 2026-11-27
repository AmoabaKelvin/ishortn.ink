import { BioRenderer, type BioRenderBlock, type BioRenderModel } from "./bio-renderer";
import { BioPageViewBeacon } from "./view-beacon";

import type { RouterOutputs } from "@/trpc/shared";

type PublicBioPage = NonNullable<RouterOutputs["bioPage"]["getBySlug"]>;

function toRenderModel(page: PublicBioPage): BioRenderModel {
  return {
    slug: page.slug,
    title: page.title,
    description: page.description,
    avatarUrl: page.avatarUrl,
    theme: page.theme,
    removeBranding: page.removeBranding,
    blocks: page.blocks.map((b): BioRenderBlock => {
      switch (b.type) {
        case "link":
          return { id: b.id, type: "link", title: b.title, href: b.href };
        case "whatsapp":
          return { id: b.id, type: "whatsapp", title: b.title, href: b.href };
        case "email":
          return { id: b.id, type: "email", title: b.title, href: b.href };
        case "social":
          return { id: b.id, type: "social", socials: b.socials };
        case "heading":
          return { id: b.id, type: "heading", title: b.title };
        case "text":
          return { id: b.id, type: "text", content: b.content };
        case "embed":
          return {
            id: b.id,
            type: "embed",
            title: b.title,
            provider: b.provider,
            embedId: b.embedId,
          };
        case "image":
          return { id: b.id, type: "image", src: b.src, alt: b.alt, href: b.href };
        default:
          return { id: b.id, type: "divider" };
      }
    }),
  };
}

/** Shared public bio page render, used by /p/[slug] and the custom-domain root. */
export function PublicBioView({ page }: { page: PublicBioPage }) {
  return (
    <main className="min-h-[100dvh]">
      <BioRenderer model={toRenderModel(page)} heightClass="min-h-[100dvh]" />
      <BioPageViewBeacon bioPageId={page.id} />
    </main>
  );
}
