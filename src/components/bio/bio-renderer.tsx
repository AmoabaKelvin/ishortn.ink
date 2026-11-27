import { IconBrandWhatsapp } from "@tabler/icons-react";

import { getBioReferralUrl } from "@/lib/attribution/referral";
import { cn } from "@/lib/utils";

import { EmbedFacade } from "./embed-facade";
import { getInitials } from "./initials";
import { socialIcon } from "./social-icons";
import { type ResolvedBioTheme, resolveBioTheme } from "./theme";
import { WHATSAPP_DEFAULT_LABEL } from "./whatsapp";

import type { EmbedProvider } from "./embed";
import type { BioPageTheme } from "@/server/db/schema";
import type { CSSProperties } from "react";

// Shared, presentational renderer used by BOTH the builder's live preview and
// the public /p/[slug] page, so the two can never drift. No hooks → it renders
// fine as a server component (near-zero client JS on the public page); embed
// facades are the only client island.

// `previewNote` is set only by the builder preview, to flag blocks that the
// public page won't show right now (hidden, scheduled, blocked).
type BioRenderBlockBase = { id: number | string; previewNote?: string | null };

export type BioRenderBlock = BioRenderBlockBase &
  (
    | { type: "link"; title: string | null; href?: string | null }
    | { type: "whatsapp"; title: string | null; href?: string | null }
    | { type: "email"; title: string | null; href?: string | null }
    | { type: "heading"; title: string | null }
    | { type: "text"; content: string | null }
    | { type: "social"; socials: { platform: string; url: string }[] }
    | { type: "divider" }
    | { type: "embed"; title: string | null; provider: EmbedProvider; embedId: string }
    | {
        type: "image";
        src: string | null;
        alt: string | null;
        href?: string | null;
        width?: number | null;
        height?: number | null;
      }
  );

export type BioRenderModel = {
  slug: string;
  title: string | null;
  description: string | null;
  avatarUrl: string | null;
  theme: BioPageTheme | null;
  removeBranding: boolean;
  blocks: BioRenderBlock[];
};

// CSS-based staggered entrance (no JS) so the public page stays light. Gated to
// motion-safe so reduced-motion users see content immediately.
const BIO_ENTER =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both";

// Media blocks slide without the fade: Chrome never takes content that fades in
// from opacity 0 as the page's LCP, and a facade or image is usually the
// largest thing in the first screen.
const BIO_ENTER_MEDIA =
  "motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both";

// The stagger stops growing after this many blocks, so long pages finish
// entering in under a second instead of trickling in one block at a time.
const MAX_STAGGER_INDEX = 8;

// Images in the first few blocks are likely in the first screen (often the
// LCP), so they load eagerly at high priority; later ones stay lazy.
const EAGER_MEDIA_BLOCKS = 3;

// `heightClass` controls how the themed background fills its container: the
// builder preview fills the fixed-height phone frame (min-h-full), while the
// public page fills the viewport (min-h-[100dvh]) so the background never stops
// at the content edge.
export function BioRenderer({
  model,
  heightClass = "min-h-full",
}: {
  model: BioRenderModel;
  heightClass?: string;
}) {
  const t = resolveBioTheme(model.theme);
  const initials = getInitials(model.title);

  return (
    <div
      className={cn("flex flex-col items-center px-5 py-12", heightClass)}
      style={{ background: t.backgroundCss, color: t.textColor, fontFamily: t.fontFamily }}
    >
      <div className="flex w-full max-w-md flex-col items-center">
        {model.avatarUrl ? (
          <div className={BIO_ENTER} style={{ animationDelay: "0ms", animationDuration: "450ms" }}>
            {/* eslint-disable-next-line next/no-img-element -- user-supplied avatar URL with unknown host and dimensions */}
            <img
              src={model.avatarUrl}
              alt={model.title ?? "Avatar"}
              className="h-24 w-24 rounded-full object-cover ring-2 ring-black/5"
            />
          </div>
        ) : (
          initials && (
            // Decorative: the title right below already names the page.
            <div
              aria-hidden="true"
              className={`flex h-24 w-24 items-center justify-center rounded-full text-2xl font-semibold ${BIO_ENTER}`}
              style={{
                background: t.accentColor,
                color: t.accentTextColor,
                animationDelay: "0ms",
                animationDuration: "450ms",
              }}
            >
              {initials}
            </div>
          )
        )}

        {model.title && (
          <h1
            className={`mt-4 max-w-full break-words text-center text-xl font-semibold ${BIO_ENTER}`}
            style={{ animationDelay: "70ms", animationDuration: "450ms" }}
          >
            {model.title}
          </h1>
        )}
        {model.description && (
          <p
            className={`mt-1.5 max-w-full break-words text-center text-sm sm:max-w-sm ${BIO_ENTER}`}
            style={{ color: t.mutedColor, animationDelay: "140ms", animationDuration: "450ms" }}
          >
            {model.description}
          </p>
        )}

        <div className="mt-7 w-full min-w-0 space-y-3">
          {model.blocks.map((block, i) => (
            <div
              key={block.id}
              className={cn(
                "min-w-0",
                block.type === "embed" || block.type === "image" ? BIO_ENTER_MEDIA : BIO_ENTER,
              )}
              style={{
                animationDelay: `${210 + Math.min(i, MAX_STAGGER_INDEX) * 55}ms`,
                animationDuration: "450ms",
              }}
            >
              {block.previewNote ? (
                <div className="opacity-50">
                  <p className="mb-1 text-center text-[11px] font-medium uppercase tracking-wide">
                    {block.previewNote}
                  </p>
                  <BioBlockView block={block} t={t} eager={i < EAGER_MEDIA_BLOCKS} />
                </div>
              ) : (
                <BioBlockView block={block} t={t} eager={i < EAGER_MEDIA_BLOCKS} />
              )}
            </div>
          ))}
        </div>

        {!model.removeBranding && (
          <a
            href={getBioReferralUrl(model.slug)}
            target="_blank"
            // No noreferrer: the referrer host is part of the visit's attribution.
            rel="noopener"
            className="mt-10 text-xs underline-offset-4 hover:underline"
            style={{ color: t.mutedColor }}
          >
            Made with iShortn · Create your own
          </a>
        )}
      </div>
    </div>
  );
}

function BioBlockView({
  block,
  t,
  eager,
}: {
  block: BioRenderBlock;
  t: ResolvedBioTheme;
  eager: boolean;
}) {
  // Media follows the theme's corners: square for sharp buttons, rounded otherwise
  // (a pill radius would crop a 16:9 frame into a capsule).
  const mediaRadius = t.buttonRadius === "0px" ? "0px" : "0.75rem";

  switch (block.type) {
    case "embed":
      return (
        <EmbedFacade
          provider={block.provider}
          embedId={block.embedId}
          title={block.title}
          radius={mediaRadius}
        />
      );

    case "image": {
      if (!block.src) return null;
      const image = (
        // width/height reserve the box before load; h-auto keeps the real ratio once it arrives.
        // eslint-disable-next-line next/no-img-element -- user-uploaded R2 image, served as uploaded
        <img
          src={block.src}
          alt={block.alt ?? ""}
          width={block.width ?? undefined}
          height={block.height ?? undefined}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          className="block h-auto w-full"
          style={{ borderRadius: mediaRadius }}
        />
      );
      return block.href ? (
        <a
          href={block.href}
          target="_blank"
          rel="noreferrer"
          aria-label={block.alt ? undefined : "Open link"}
          className="block transition-opacity hover:opacity-90"
        >
          {image}
        </a>
      ) : (
        image
      );
    }

    case "heading":
      return block.title ? (
        <h2 className="break-words pt-3 text-center text-base font-semibold">{block.title}</h2>
      ) : null;

    case "text":
      return block.content ? (
        <p
          className="whitespace-pre-line break-words text-center text-sm"
          style={{ color: t.mutedColor }}
        >
          {block.content}
        </p>
      ) : null;

    case "divider":
      return (
        <hr
          className="my-1 border-0 border-t"
          style={{ borderColor: t.mutedColor, opacity: 0.25 }}
        />
      );

    case "social":
      return (
        <div className="flex flex-wrap items-center justify-center gap-4 py-1">
          {block.socials.map((s, i) => {
            const Icon = socialIcon(s.platform);
            return (
              <a
                key={`${s.platform}-${i}`}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                aria-label={s.platform}
                className="opacity-80 transition-opacity hover:opacity-100"
              >
                <Icon size={22} />
              </a>
            );
          })}
        </div>
      );

    case "link":
    case "whatsapp":
    case "email": {
      const href = block.href ?? undefined;
      const isOutline = t.buttonVariant === "outline";
      const style: CSSProperties = isOutline
        ? {
            borderRadius: t.buttonRadius,
            border: `1.5px solid ${t.accentColor}`,
            color: t.accentColor,
          }
        : {
            borderRadius: t.buttonRadius,
            background: t.accentColor,
            color: t.accentTextColor,
          };
      const label =
        block.title ||
        (block.type === "email"
          ? "Email me"
          : block.type === "whatsapp"
            ? WHATSAPP_DEFAULT_LABEL
            : "Visit");
      return (
        <a
          href={href}
          {...(block.type === "email" ? {} : { target: "_blank", rel: "noreferrer" })}
          className="flex w-full items-center justify-center gap-2 break-words px-5 py-3.5 text-center text-sm font-medium shadow-sm transition-transform motion-safe:hover:-translate-y-0.5"
          style={style}
        >
          {block.type === "whatsapp" && (
            <IconBrandWhatsapp size={18} stroke={1.75} aria-hidden="true" className="shrink-0" />
          )}
          <span className="min-w-0">{label}</span>
        </a>
      );
    }

    default:
      return null;
  }
}
