import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { env } from "@/env.mjs";
import { getPaddleClient } from "@/lib/paddle/client";
import { getPaddleConfig } from "@/lib/paddle/config";
import { db } from "@/server/db";
import { subscription } from "@/server/db/schema";

import { AlreadySubscribedState } from "./_components/already-subscribed";
import { checkoutAccess } from "./_components/checkout-access";
import { CheckoutReplacedState } from "./_components/checkout-replaced";
import { PaddleCheckout } from "./_components/paddle-checkout";
import { parseTransactionId } from "./_components/transaction-id";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Checkout" };

// The client token is a runtime secret; it must be read per request, not inlined at build.
export const dynamic = "force-dynamic";

// Paddle's default payment link: server-created transactions (new checkouts and payment-method
// updates, including links in Paddle's own emails) open here with `?_ptxn=txn_…`.
export default async function CheckoutPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ _ptxn }, { userId }] = await Promise.all([props.searchParams, auth()]);
  const config = getPaddleConfig();
  const client = getPaddleClient();
  const transactionId = parseTransactionId(_ptxn);
  if (!config || !client || !transactionId || !userId) redirect("/dashboard/pricing");

  const userSubscription = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
  });
  // A failed lookup falls through to the dashboard error boundary rather than opening a checkout
  // that could start a second subscription.
  const access = await checkoutAccess(userSubscription, () => client.getTransaction(transactionId));
  if (access === "subscribed") return <AlreadySubscribedState />;
  if (access === "replaced") return <CheckoutReplacedState />;

  return (
    <PaddleCheckout
      environment={config.environment}
      clientToken={config.clientToken}
      transactionId={transactionId}
      successUrl={`${env.NEXT_PUBLIC_APP_URL}/dashboard/settings?checkout=success#billing`}
    />
  );
}
