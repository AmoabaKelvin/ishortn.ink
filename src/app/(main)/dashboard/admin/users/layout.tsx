import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin Users" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
