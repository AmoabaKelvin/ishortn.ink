"use client";

import { CheckIcon, EllipsisVertical, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { api } from "@/trpc/react";

import { revalidateRoute } from "../../actions/revalidate-homepage";

import type { RouterOutputs } from "@/trpc/shared";
type BillingPageProps = {
  subscriptions: RouterOutputs["subscriptions"]["get"];
};

function Billing({ subscriptions }: BillingPageProps) {
  const userSubcription = subscriptions?.subscriptions;

  const hasActiveSubscription = userSubcription?.status === "active";

  const getCheckoutUrlMutation = api.lemonsqueezy.createCheckoutUrl.useMutation();

  const handleUpgrade = async () => {
    try {
      const checkoutUrl = await getCheckoutUrlMutation.mutateAsync();
      checkoutUrl && window.open(checkoutUrl);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      {/* page header, with title and subtext */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="mt-2 text-gray-500">Manage your subscription and billing information.</p>
      </div>
      <Separator />
      {/* show  information about current plan */}
      <div className="flex flex-col py-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-xl">
              {hasActiveSubscription ? "Pro Plan" : "Free Plan"}

              {hasActiveSubscription && <ManageProPlan />}
            </CardTitle>
            <CardDescription>
              {/* You are currently on the Free plan. Upgrade to unlock more features. */}
              {hasActiveSubscription
                ? "You are currently on the Pro plan. Thank you for supporting us!"
                : "You are currently on the Free plan. Upgrade to unlock more features."}
            </CardDescription>

            {hasActiveSubscription && (
              <CardContent className="p-0 pt-4">
                {/* we will show the card details and the next payment date */}
                <div className="flex flex-col space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Card ending in</span>
                    <span className="text-sm font-bold">
                      {/* {subscriptions.cardLastFour ?? "****"} */}
                      {userSubcription?.cardLastFour ?? "****"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Next payment</span>
                    <span className="text-sm font-bold">
                      {/* {hasActiveSubscription
                        ? new Date(subscriptions.renewsAt).toDateString()
                        : "-"} */}
                      {hasActiveSubscription
                        ? new Date(userSubcription.renewsAt!).toDateString()
                        : "-"}
                    </span>
                  </div>
                </div>
              </CardContent>
            )}
          </CardHeader>
        </Card>

        {/* View the different plans for the site */}
        <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2">
          <Card className="flex flex-col p-2">
            <CardHeader className="h-full">
              <CardTitle className="line-clamp-1">Pro</CardTitle>
              <CardDescription className="line-clamp-2">
                Unlock advanced features and support the development of this amazing product.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 h-full space-y-6">
              <div className="text-3xl font-bold">
                $5
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <div className="space-y-2">
                {planBenfits.pro.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <div className="p-px rounded-full aspect-square shrink-0 bg-foreground text-background">
                      <CheckIcon className="size-4" aria-hidden="true" />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="pt-4">
              <Button
                className="w-full"
                disabled={hasActiveSubscription || getCheckoutUrlMutation.isLoading}
                onClick={handleUpgrade}
                data-umami-event="Upgrade Plan"
              >
                {getCheckoutUrlMutation.isLoading && (
                  <Loader2 className="mr-2 size-5 animate-spin" />
                )}
                Upgrade now
                <span className="sr-only">Upgrade now</span>
              </Button>
            </CardFooter>
          </Card>
          <Card className="flex flex-col p-2">
            <CardHeader className="">
              <CardTitle className="line-clamp-1">Free</CardTitle>
              <CardDescription className="line-clamp-2">
                The free plan is perfect for getting started with the basics. Upgrade to unlock more
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 h-full space-y-6">
              <div className="text-3xl font-bold">
                $0
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <div className="space-y-2">
                {planBenfits.free.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <div className="p-px rounded-full aspect-square shrink-0 bg-foreground text-background">
                      <CheckIcon className="size-4" aria-hidden="true" />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="pt-4">
              <Button className="w-full" asChild>
                <Link href="/dashboard">
                  Get started
                  <span className="sr-only">Get started</span>
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Billing;

function ManageProPlan() {
  const cancelSubscriptionMutation = api.lemonsqueezy.cancelSubscription.useMutation();
  const updateSubscriptionDetailsMutation = api.lemonsqueezy.subscriptionDetails.useMutation();

  const handleCancelSubscription = async () => {
    try {
      await cancelSubscriptionMutation.mutateAsync();
      await revalidateRoute("/dashboard/settings/billing");
      toast.success("Subscription cancelled successfully");
    } catch (_error) {
      toast.error("Failed to cancel subscription");
    }
  };

  const handleUpdateSubscription = async () => {
    try {
      const updateUrl = await updateSubscriptionDetailsMutation.mutateAsync();

      if (updateUrl) {
        window.location.href = updateUrl.update_payment_method;
      }
    } catch (_error) {
      toast.error("Failed to update subscription details");
    }
  };

  const handleCustomerPortalVisit = async () => {
    try {
      const portalUrl = await updateSubscriptionDetailsMutation.mutateAsync();

      if (portalUrl) {
        window.location.href = portalUrl.customer_portal;
      }
    } catch (_error) {
      toast.error("Failed to visit customer portal");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" className="p-0.5">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem onClick={handleUpdateSubscription}>
          <span>Update payment method</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleCustomerPortalVisit}
          data-umami-event="Visit Customer Portal"
        >
          <span>Customer portal</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-500"
          onClick={handleCancelSubscription}
          data-umami-event="Cancel Subscription"
        >
          <span>Cancel subscription</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const planBenfits = {
  free: [
    "Unlimited links",
    "Custom alias",
    "Basic analytics",
    "30 days of analytics data retention",
    "Up to 3 QR Codes",
    "API access with limits",
  ],
  pro: [
    "Custom domains for link shortening",
    "Advanced analytics",
    "Unlimited tracked links",
    "Unlimited QR Codes",
    "1 year of analytics data retention",
    "Password-protected links",
    "Bulk link creation via CSV",
    "API access",
    "Geotargeting",
    "Priority support",
  ],
};
