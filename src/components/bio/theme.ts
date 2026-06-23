import type { BioPageTheme } from "@/server/db/schema";

export type ResolvedBioTheme = {
  backgroundCss: string; // value for the CSS `background` property
  textColor: string;
  mutedColor: string;
  accentColor: string;
  accentTextColor: string; // readable text color on top of the accent
  buttonRadius: string;
  buttonVariant: "solid" | "outline";
  fontFamily: string;
};

type Preset = {
  background: string;
  text: string;
  muted: string;
  accent: string;
  buttonStyle: "rounded" | "pill" | "sharp" | "outline";
};

export const BIO_PRESETS: Record<string, Preset> = {
  minimal: {
    background: "#ffffff",
    text: "#0a0a0a",
    muted: "#6b7280",
    accent: "#0a0a0a",
    buttonStyle: "rounded",
  },
  mono: {
    background: "#f4f4f5",
    text: "#18181b",
    muted: "#71717a",
    accent: "#18181b",
    buttonStyle: "sharp",
  },
  midnight: {
    background: "#0b0b10",
    text: "#f5f5f7",
    muted: "#9ca3af",
    accent: "#6366f1",
    buttonStyle: "pill",
  },
  sunset: {
    background: "linear-gradient(160deg, #ff9a8b 0%, #ff6a88 55%, #ff99ac 100%)",
    text: "#1a1a1a",
    muted: "#4b5563",
    accent: "#1a1a1a",
    buttonStyle: "pill",
  },
  forest: {
    background: "linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    text: "#eaf7ef",
    muted: "#9fc3b0",
    accent: "#34d399",
    buttonStyle: "rounded",
  },
  bubblegum: {
    background: "linear-gradient(160deg, #fbc2eb 0%, #a6c1ee 100%)",
    text: "#222222",
    muted: "#555555",
    accent: "#7c3aed",
    buttonStyle: "pill",
  },
};

export const BIO_PRESET_OPTIONS = Object.keys(BIO_PRESETS);

export const BIO_FONTS: Record<string, string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "ui-serif, Georgia, Cambria, 'Times New Roman', serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  rounded: "'SF Pro Rounded', ui-rounded, 'Hiragino Maru Gothic ProN', sans-serif",
};

const BUTTON_RADIUS: Record<string, string> = {
  rounded: "0.75rem",
  pill: "9999px",
  sharp: "0px",
  outline: "0.75rem",
};

/** Pick black or white text for legibility on a given hex background. */
export function readableTextOn(hex: string): string {
  const match = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.exec(hex.trim());
  if (!match) return "#ffffff";
  let h = match[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance (sRGB)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0a0a0a" : "#ffffff";
}

export function resolveBioTheme(theme?: BioPageTheme | null): ResolvedBioTheme {
  const preset = BIO_PRESETS[theme?.preset ?? "minimal"] ?? BIO_PRESETS.minimal!;
  const buttonStyle = theme?.buttonStyle ?? preset.buttonStyle;

  let backgroundCss = preset.background;
  if (theme?.background) {
    if (theme.background.type === "solid" && theme.background.color) {
      backgroundCss = theme.background.color;
    } else if (
      theme.background.type === "gradient" &&
      theme.background.from &&
      theme.background.to
    ) {
      backgroundCss = `linear-gradient(160deg, ${theme.background.from} 0%, ${theme.background.to} 100%)`;
    }
  }

  const accentColor = theme?.accentColor ?? preset.accent;

  return {
    backgroundCss,
    textColor: preset.text,
    mutedColor: preset.muted,
    accentColor,
    accentTextColor: readableTextOn(accentColor),
    buttonRadius: BUTTON_RADIUS[buttonStyle] ?? "0.75rem",
    buttonVariant: buttonStyle === "outline" ? "outline" : "solid",
    fontFamily: BIO_FONTS[theme?.font ?? "sans"] ?? BIO_FONTS.sans!,
  };
}
