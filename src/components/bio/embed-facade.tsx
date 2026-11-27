"use client";

import {
  IconBrandSoundcloud,
  IconBrandSpotifyFilled,
  IconBrandTiktokFilled,
  IconBrandVimeo,
  IconBrandYoutubeFilled,
  IconMapPinFilled,
  IconPlayerPlayFilled,
} from "@tabler/icons-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import {
  buildEmbedSrc,
  EMBED_PROVIDER_LABELS,
  embedFallbackTitle,
  embedFrameSize,
  type EmbedProvider,
} from "./embed";

import type { CSSProperties } from "react";

// Provider marks keep their brand colour on the facade's dark surface, so a
// visitor can tell what will load before tapping.
const PROVIDER_MARK = {
  youtube: { icon: IconBrandYoutubeFilled, color: "#ff0033" },
  vimeo: { icon: IconBrandVimeo, color: "#17d5ff" },
  spotify: { icon: IconBrandSpotifyFilled, color: "#1ed760" },
  soundcloud: { icon: IconBrandSoundcloud, color: "#ff5500" },
  tiktok: { icon: IconBrandTiktokFilled, color: "#ffffff" },
  maps: { icon: IconMapPinFilled, color: "#ea4335" },
} satisfies Record<EmbedProvider, { icon: typeof IconMapPinFilled; color: string }>;

const AUDIO_PROVIDERS = new Set<EmbedProvider>(["spotify", "soundcloud"]);

/**
 * Click-to-load embed. The first paint is a plain button sized exactly like
 * the player, so no third-party script, iframe or image loads until the
 * visitor asks for it, and swapping in the iframe doesn't move the page.
 */
export function EmbedFacade({
  provider,
  embedId,
  title,
  radius,
}: {
  provider: EmbedProvider;
  embedId: string;
  title: string | null;
  radius: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const src = buildEmbedSrc({ provider, embedId });
  if (!src) return null;

  const size = embedFrameSize({ provider, embedId });
  const frameStyle: CSSProperties = {
    borderRadius: radius,
    ...("height" in size ? { height: size.height } : { aspectRatio: size.aspect }),
  };
  const label = EMBED_PROVIDER_LABELS[provider];
  const name = title || embedFallbackTitle({ provider, embedId });
  const mark = PROVIDER_MARK[provider];
  const isMap = provider === "maps";
  const isAudio = AUDIO_PROVIDERS.has(provider);

  return (
    // TikTok's player is portrait; at full width it would fill the whole screen.
    <div className={cn("w-full", provider === "tiktok" && "mx-auto max-w-[325px]")}>
      {loaded ? (
        <div className="overflow-hidden bg-neutral-900" style={frameStyle}>
          <iframe
            src={src}
            title={name}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="block h-full w-full border-0"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          aria-label={isMap ? `Load map: ${name}` : `Play ${name} on ${label}`}
          className={cn(
            "group relative flex w-full overflow-hidden bg-neutral-900 text-left text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
            isAudio ? "items-center gap-3 p-4" : "items-center justify-center",
          )}
          style={frameStyle}
        >
          {isAudio ? (
            <>
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <mark.icon size={28} style={{ color: mark.color }} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 break-words text-sm font-medium">{name}</span>
                <span className="mt-0.5 block text-xs text-white/60">{label}</span>
              </span>
              <PlayButton />
            </>
          ) : (
            <>
              {isMap ? (
                <span className="flex items-center gap-1.5 rounded-full bg-white/95 py-2 pl-2.5 pr-3.5 text-sm font-medium text-neutral-900 transition-transform duration-150 ease-out group-hover:scale-105 group-active:scale-95">
                  <IconMapPinFilled size={16} style={{ color: mark.color }} aria-hidden="true" />
                  Load map
                </span>
              ) : (
                <PlayButton />
              )}
              {/* Caption: provider + title, pinned to the bottom */}
              <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8">
                <mark.icon
                  size={18}
                  className="shrink-0"
                  style={{ color: mark.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate text-sm font-medium">{name}</span>
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

function PlayButton() {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/95 text-neutral-900 transition-transform duration-150 ease-out group-hover:scale-105 group-active:scale-95">
      <IconPlayerPlayFilled size={20} aria-hidden="true" className="translate-x-px" />
    </span>
  );
}
