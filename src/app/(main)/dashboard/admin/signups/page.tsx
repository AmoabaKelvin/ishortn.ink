import { api } from "@/trpc/server";

import { SignupsView } from "./_components/signups-view";

export default async function AdminSignupsPage() {
  const data = await api.admin.getSignupAttribution.query();
  return <SignupsView data={data} />;
}
