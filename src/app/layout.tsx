import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iShortn",
  description: `Power up your links with our AI-driven analytics, advanced URL
  shortening, and dynamic QR code creation and boost engagement
  results like never before. Unleash the power of your links today!`,
  authors: [
    {
      name: "Kelvin Amoaba",
      url: "https://www.kelvinamoaba.live",
    },
  ],
  applicationName: "iShortn",
  creator: "Kelvin Amoaba",
  robots: "index, follow",
  category: "Technology",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
