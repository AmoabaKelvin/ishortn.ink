import { Google_Sans, Inter } from "next/font/google";
import localFont from "next/font/local";

export const satoshi = localFont({
  src: "../styles/Satoshi-Variable.woff2",
  variable: "--font-satoshi",
  weight: "300 900",
  display: "swap",
  style: "normal",
});

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
