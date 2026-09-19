import type { Appearance } from "@clerk/types";

// Site theme for Clerk (docs/design-language.md). Static styles only:
// hover/focus/first-child states live in src/styles/site-auth.css under the
// stable `.cl-*` class names Clerk assigns to every element.
//
// Mapping: cardBox = the neutral-50 "tray", card = the white card on it,
// footer = the strip under the card (Clerk's own link keeps redirect params).
const ink = "#171717";
const body = "#525252";
const hairline = "rgb(10 10 10 / 0.07)";
const fontBody = "var(--font-inter), ui-sans-serif, system-ui, sans-serif";
// Same values as tailwind.config.ts `shadow-site-card` / `shadow-site-btn`
const shadowCard =
  "0 0 0 1px rgb(10 10 10 / 0.06), 0 1px 2px rgb(10 10 10 / 0.04), 0 6px 16px -6px rgb(10 10 10 / 0.05)";
const shadowField = "0 0 0 1px rgb(10 10 10 / 0.1), 0 1px 2px rgb(10 10 10 / 0.06)";

export const siteClerkAppearance: Appearance = {
  layout: {
    // The auth layout renders our Wordmark above the tray
    logoPlacement: "none",
    socialButtonsPlacement: "top",
    socialButtonsVariant: "blockButton",
    showOptionalFields: true,
    privacyPageUrl: "/privacy",
    termsPageUrl: "/terms",
  },
  variables: {
    colorPrimary: ink,
    colorText: ink,
    colorTextSecondary: body,
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: ink,
    colorNeutral: ink,
    colorDanger: "#dc2626",
    fontFamily: fontBody,
    fontFamilyButtons: fontBody,
    borderRadius: "10px",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: {
      width: "100%",
      maxWidth: "100%",
      background: "#fafafa",
      borderRadius: 28,
      border: "none",
      boxShadow: shadowCard,
    },
    card: {
      background: "#ffffff",
      borderRadius: 28,
      border: "none",
      boxShadow: shadowCard,
    },
    headerTitle: {
      fontFamily: "var(--font-title), ui-sans-serif, system-ui, sans-serif",
      fontWeight: 600,
      fontSize: 24,
      letterSpacing: "-0.035em",
      color: ink,
    },
    headerSubtitle: { color: body, fontSize: 16 },
    socialButtonsBlockButton: {
      minHeight: 44,
      borderRadius: 10,
      border: "none",
      background: "rgb(10 10 10 / 0.06)",
      color: ink,
      boxShadow: "none",
    },
    socialButtonsBlockButtonText: { color: "inherit", fontWeight: 500, fontSize: 14 },
    dividerLine: { background: hairline },
    dividerText: { color: body, fontSize: 14 },
    formFieldLabel: { color: ink, fontWeight: 500, fontSize: 14 },
    formFieldInput: {
      minHeight: 44,
      background: "#ffffff",
      border: "none",
      borderRadius: 10,
      color: ink,
      // 16px keeps iOS from zooming on focus
      fontSize: 16,
      boxShadow: shadowField,
    },
    formFieldAction: { color: body, fontWeight: 500 },
    formButtonPrimary: {
      minHeight: 44,
      background: ink,
      color: "#ffffff",
      border: "none",
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 500,
      textTransform: "none",
      letterSpacing: 0,
    },
    footer: { background: "transparent" },
    footerActionText: { color: body },
    footerActionLink: { color: ink, fontWeight: 500 },
  },
};
