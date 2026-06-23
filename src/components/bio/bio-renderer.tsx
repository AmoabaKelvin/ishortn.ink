import { cn } from "@/lib/utils";

import { socialIcon } from "./social-icons";
import { type ResolvedBioTheme, resolveBioTheme } from "./theme";

import type { BioPageTheme } from "@/server/db/schema";
import type { CSSProperties } from "react";

// Shared, presentational renderer used by BOTH the builder's live preview and
// the public /p/[slug] page, so the two can never drift. No hooks → it renders
// fine as a server component (near-zero client JS on the public page).

export type BioRenderBlock =
  | { id: number | string; type: "link"; title: string | null; href?: string | null }
  | { id: number | string; type: "email"; title: string | null; href?: string | null }
  | { id: number | string; type: "heading"; title: string | null }
  | { id: number | string; type: "text"; content: string | null }
  | { id: number | string; type: "social"; socials: { platform: string; url: string }[] }
  | { id: number | string; type: "divider" };

export type BioRenderModel = {
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

  return (
    <div
      className={cn("flex flex-col items-center px-5 py-12", heightClass)}
      style={{ background: t.backgroundCss, color: t.textColor, fontFamily: t.fontFamily }}
    >
      <div className="flex w-full max-w-md flex-col items-center">
        <div className={BIO_ENTER} style={{ animationDelay: "0ms", animationDuration: "450ms" }}>
          {model.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={model.avatarUrl}
              alt={model.title ?? "Avatar"}
              className="h-24 w-24 rounded-full object-cover ring-2 ring-black/5"
            />
          ) : (
            <div
              className="h-24 w-24 rounded-full"
              style={{ background: t.accentColor, opacity: 0.15 }}
            />
          )}
        </div>

        {model.title && (
          <h1
            className={`mt-4 text-xl font-semibold ${BIO_ENTER}`}
            style={{ animationDelay: "70ms", animationDuration: "450ms" }}
          >
            {model.title}
          </h1>
        )}
        {model.description && (
          <p
            className={`mt-1.5 max-w-sm text-center text-sm ${BIO_ENTER}`}
            style={{ color: t.mutedColor, animationDelay: "140ms", animationDuration: "450ms" }}
          >
            {model.description}
          </p>
        )}

        <div className="mt-7 w-full space-y-3">
          {model.blocks.map((block, i) => (
            <div
              key={block.id}
              className={BIO_ENTER}
              style={{ animationDelay: `${210 + i * 55}ms`, animationDuration: "450ms" }}
            >
              <BioBlockView block={block} t={t} />
            </div>
          ))}
        </div>

        {!model.removeBranding && (
          <a
            href="https://ishortn.ink"
            target="_blank"
            rel="noreferrer"
            className="mt-10 text-xs opacity-60 transition-opacity hover:opacity-100"
            style={{ color: t.mutedColor }}
          >
            Made with iShortn
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
        <h2 className="pt-3 text-center text-base font-semibold">{block.title}</h2>
      ) : null;

    case "text":
      return block.content ? (
        <p className="whitespace-pre-line text-center text-sm" style={{ color: t.mutedColor }}>
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
          className="block w-full px-5 py-3.5 text-center text-sm font-medium shadow-sm transition-transform hover:-translate-y-0.5"
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
