import type { Appearance } from "@clerk/types";

// Warm palette tokens (kept in sync with globals.css [data-theme="warm"]).
// Static styles only — hover/focus states live in globals.css under the
// stable `.cl-*` class names Clerk assigns to every element.
const ink = "#2B1F17";
const inkSoft = "#4A3A2E";
const mute = "#8A7868";
const paper = "#FFFCF5";
const bg = "#F7F1E8";
const line = "#E6D9C5";
const lineSoft = "#EFE6D4";
const terracotta = "#C85C3B";

export const warmClerkAppearance: Appearance = {
  layout: {
    // Hide Clerk's built-in logo — our page layout already shows the wordmark
    // in the top-left corner. Avoids a duplicate brand mark on the card.
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
    colorTextSecondary: mute,
    colorBackground: paper,
    colorInputBackground: bg,
    colorInputText: ink,
    colorNeutral: ink,
    colorDanger: "#B1482A",
    colorSuccess: "#6E8A66",
    fontFamily: "var(--font-warm-ui), Inter, system-ui, sans-serif",
    fontFamilyButtons: "var(--font-warm-ui), Inter, system-ui, sans-serif",
    borderRadius: "14px",
    spacingUnit: "1rem",
  },
  elements: {
    rootBox: {
      width: "100%",
      maxWidth: 440,
      margin: "0 auto",
      fontFamily: "var(--font-warm-ui), Inter, system-ui, sans-serif",
    },
    cardBox: {
      boxShadow: "0 40px 80px -40px rgba(43,31,23,0.18)",
      border: `1px solid ${line}`,
      borderRadius: 24,
      background: paper,
    },
    card: {
      background: paper,
      boxShadow: "none",
      border: "none",
      borderRadius: 24,
      padding: "40px 32px",
    },
    headerTitle: {
      fontFamily: "var(--font-warm-display), Georgia, serif",
      fontWeight: 500,
      fontSize: 28,
      letterSpacing: "-0.02em",
      color: ink,
    },
    headerSubtitle: {
      color: mute,
      fontSize: 14,
    },
    formFieldLabel: {
      color: inkSoft,
      fontWeight: 500,
      fontSize: 13,
    },
    formFieldInput: {
      background: bg,
      border: `1px solid ${line}`,
      borderRadius: 12,
      color: ink,
      padding: "12px 14px",
      fontSize: 14,
      boxShadow: "none",
    },
    formButtonPrimary: {
      background: ink,
      color: paper,
      border: "none",
      outline: "none",
      boxShadow: "none",
      borderRadius: 999,
      padding: "12px 20px",
      fontSize: 14,
      fontWeight: 500,
      textTransform: "none",
      letterSpacing: 0,
    },
    socialButtonsBlockButton: {
      background: paper,
      border: `1px solid ${line}`,
      borderRadius: 999,
      color: inkSoft,
      boxShadow: "none",
      padding: "12px 18px",
      minHeight: 48,
      fontSize: 14,
    },
    socialButtonsBlockButtonText: {
      color: inkSoft,
      fontWeight: 500,
      fontSize: 14,
    },
    socialButtonsProviderIcon: {
      width: 18,
      height: 18,
    },
    dividerLine: { background: lineSoft },
    dividerText: { color: mute, fontSize: 12 },
    footerActionLink: {
      color: terracotta,
      fontWeight: 500,
    },
    formFieldErrorText: { color: "#B1482A", fontSize: 12 },
    alertText: { color: inkSoft, fontSize: 13 },
    identityPreview: {
      background: bg,
      border: `1px solid ${line}`,
      borderRadius: 12,
    },
    footer: {
      background: "transparent",
      borderTop: `1px solid ${lineSoft}`,
    },
  },
};
