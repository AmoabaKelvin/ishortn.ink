import { api } from "@/trpc/server";

import Billing from "./billing";

async function BillingPage() {
  const subscriptions = await api.subscriptions.get.query();

  return <Billing subscriptions={subscriptions} />;
}

export default BillingPage;
