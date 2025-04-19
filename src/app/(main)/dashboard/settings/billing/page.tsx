import { api } from "@/trpc/server";

import Billing from "./billing";

export const dynamic = 'force-dynamic'

async function BillingPage() {
  const subscriptions = await api.subscriptions.get.query();

  return <Billing subscriptions={subscriptions} />;
}

export default BillingPage;
