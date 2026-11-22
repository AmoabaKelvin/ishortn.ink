import "@/styles/globals.css";
import { Bricolage_Grotesque, DM_Sans, Instrument_Serif } from "next/font/google";

// None of these render on marketing, docs or auth pages, so they aren't preloaded: the browser
// fetches a face only once text on the page uses it.
export const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  preload: false,
  weight: ["300", "400", "500", "600", "700"],
});

export const fontDisplay = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-display",
  preload: false,
  weight: ["400"],
  style: ["normal", "italic"],
});

export const fontHeading = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-heading",
  preload: false,
  weight: ["400", "600", "700", "800"],
});
