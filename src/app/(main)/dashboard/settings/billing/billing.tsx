"use client";

import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/trpc/react";
import { RouterOutputs } from "@/trpc/shared";

type BillingProps = {
  subscriptions: RouterOutputs["subscriptions"]["get"];
};

export default function Billing({ subscriptions }: BillingProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const subscription = subscriptions?.subscriptions;

  const getSubscriptionDetails =
    api.lemonsqueezy.subscriptionDetails.useMutation({
      onSuccess: (urls) => {
        if (urls.customer_portal) {
          window.location.href = urls.customer_portal;
        } else if (urls.update_payment_method) {
          window.location.href = urls.update_payment_method;
        } else {
          toast.error("Could not find subscription portal URL");
          setIsLoading(false);
        }
      },
      onError: (error) => {
        toast.error(error.message);
        setIsLoading(false);
      },
    });

  const handleManageSubscription = () => {
    setIsLoading(true);
    getSubscriptionDetails.mutate();
  };

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Subscription</CardTitle>
          <CardDescription>
            You are currently on the free plan. Upgrade to Pro to unlock more
            features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push("/dashboard/pricing")}>
            View Plans
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Details</CardTitle>
        <CardDescription>
          Manage your subscription and billing information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <Badge
              variant={
                subscription.status === "active" ? "default" : "destructive"
              }
              className="capitalize"
            >
              {subscription.status}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Plan</p>
            <p className="font-medium capitalize">
              {subscriptions?.plan
                ? `${subscriptions.plan} Plan`
                : "Free Plan"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Renews At
            </p>
            <p className="font-medium">
              {subscription.renewsAt
                ? format(new Date(subscription.renewsAt), "PPP")
                : "N/A"}
            </p>
          </div>
          {subscription.cardLastFour && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Payment Method
              </p>
              <p className="font-medium capitalize">
                {subscription.cardBrand} •••• {subscription.cardLastFour}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Button
            onClick={handleManageSubscription}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Manage Subscription
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push("/dashboard/pricing")}
          >
            Change Plan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
