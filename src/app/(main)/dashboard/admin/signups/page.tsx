import { api } from "@/trpc/server";

import { SignupsView } from "./_components/signups-view";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Signups" };

export default async function AdminSignupsPage() {
  const data = await api.admin.getSignupAttribution.query();
  return <SignupsView data={data} />;
}
