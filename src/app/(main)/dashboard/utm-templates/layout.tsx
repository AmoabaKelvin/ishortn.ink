import type { Metadata } from "next";

export const metadata: Metadata = { title: "UTM Templates" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
