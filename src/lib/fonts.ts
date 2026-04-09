import "@/styles/globals.css";

import {
  Bricolage_Grotesque,
  DM_Sans,
  Eagle_Lake,
  Instrument_Serif,
} from "next/font/google";

export const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

export const fontDisplay = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400"],
  style: ["normal", "italic"],
});

export const fontHeading = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "600", "700", "800"],
});

export const fontLogo = Eagle_Lake({
  subsets: ["latin"],
  variable: "--font-logo",
  weight: ["400"],
});
