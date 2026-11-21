import { cache } from "react";

import { api } from "@/trpc/server";

// The layout and the sidebar both need the subscription; cache() keeps it to one query per request.
export const getDashboardSubscription = cache(() =>
  api.subscriptions.get.query().catch(() => null),
);
