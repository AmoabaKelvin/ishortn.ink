import { Google_Sans, Inter } from "next/font/google";

// Marketing + auth display font (docs/design-language.md)
export const fontTitle = Google_Sans({
  variable: "--font-title",
  subsets: ["latin"],
  display: "swap",
});

export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});
