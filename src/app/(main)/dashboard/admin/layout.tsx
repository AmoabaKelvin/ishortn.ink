import { redirect } from "next/navigation";

import { api } from "@/trpc/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await api.user.getProfile.query();

  if (!profile.isAdmin) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
