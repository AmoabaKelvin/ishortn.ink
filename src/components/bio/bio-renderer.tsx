import { getBioReferralUrl } from "@/lib/attribution/referral";
import { cn } from "@/lib/utils";

import { getInitials } from "./initials";
import { socialIcon } from "./social-icons";
import { type ResolvedBioTheme, resolveBioTheme } from "./theme";

import type { BioPageTheme } from "@/server/db/schema";
import type { CSSProperties } from "react";

// Shared, presentational renderer used by BOTH the builder's live preview and
// the public /p/[slug] page, so the two can never drift. No hooks → it renders
// fine as a server component (near-zero client JS on the public page).

// `previewNote` is set only by the builder preview, to flag blocks that the
// public page won't show right now (hidden, scheduled, blocked).
type BioRenderBlockBase = { id: number | string; previewNote?: string | null };

export type BioRenderBlock = BioRenderBlockBase &
  (
    | { type: "link"; title: string | null; href?: string | null }
    | { type: "email"; title: string | null; href?: string | null }
    | { type: "heading"; title: string | null }
    | { type: "text"; content: string | null }
    | { type: "social"; socials: { platform: string; url: string }[] }
    | { type: "divider" }
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

// The stagger stops growing after this many blocks, so long pages finish
// entering in under a second instead of trickling in one block at a time.
const MAX_STAGGER_INDEX = 8;

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
              className={cn("min-w-0", BIO_ENTER)}
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
                  <BioBlockView block={block} t={t} />
                </div>
              ) : (
                <BioBlockView block={block} t={t} />
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

function BioBlockView({ block, t }: { block: BioRenderBlock; t: ResolvedBioTheme }) {
  switch (block.type) {
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
      const label = block.title || (block.type === "email" ? "Email me" : "Visit");
      return (
        <a
          href={href}
          {...(block.type === "link" ? { target: "_blank", rel: "noreferrer" } : {})}
          className="block w-full break-words px-5 py-3.5 text-center text-sm font-medium shadow-sm transition-transform motion-safe:hover:-translate-y-0.5"
          style={style}
        >
          {label}
        </a>
      );
    }

    default:
      return null;
  }
}
