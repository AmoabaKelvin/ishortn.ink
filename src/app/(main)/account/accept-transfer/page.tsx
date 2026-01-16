"use client";

import { useAuth } from "@clerk/nextjs";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  FolderOpen,
  Globe,
  Link2,
  Loader2,
  Package,
  QrCode,
  Tag,
  User,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

function StateCard({
  icon,
  iconBg,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ animationFillMode: "backwards" }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-xl shadow-neutral-900/5 p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neutral-50 to-transparent" />

        <div className="relative text-center">
          <div
            className={cn(
              "inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5",
              iconBg
            )}
          >
            {icon}
          </div>

          <h1 className="font-semibold text-xl text-neutral-900 mb-2">{title}</h1>
          <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
            {description}
          </p>

          {children}
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="relative">
        <div className="h-10 w-10 rounded-full border-2 border-neutral-200" />
        <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    </div>
  );
}

function AcceptTransferContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();
  const token = searchParams.get("token");

  const transferDetails = api.accountTransfer.getByToken.useQuery(
    { token: token! },
    {
      enabled: !!token && isSignedIn,
    }
  );

  const acceptMutation = api.accountTransfer.accept.useMutation({
    onSuccess: () => {
      toast.success("Account transfer completed successfully!");
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAccept = () => {
    if (token) {
      acceptMutation.mutate({ token });
    }
  };

  // No token
  if (!token) {
    return (
      <StateCard
        icon={<AlertCircle className="h-6 w-6 text-red-500" />}
        iconBg="bg-red-50"
        title="Invalid transfer link"
        description="This transfer link is incomplete or malformed."
      >
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard")}
          className="w-full"
        >
          Go to Dashboard
        </Button>
      </StateCard>
    );
  }

  // Loading auth
  if (!isLoaded) {
    return <LoadingSpinner />;
  }

  // Not signed in
  if (!isSignedIn) {
    return (
      <StateCard
        icon={<User className="h-6 w-6 text-neutral-600" />}
        iconBg="bg-neutral-100"
        title="Sign in to continue"
        description="You need to sign in to accept this account transfer."
      >
        <Button
          onClick={() =>
            router.push(
              `/auth/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`
            )
          }
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          Sign in
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </StateCard>
    );
  }

  // Loading transfer
  if (transferDetails.isLoading) {
    return <LoadingSpinner />;
  }

  // Transfer not found
  if (!transferDetails.data) {
    return (
      <StateCard
        icon={<AlertCircle className="h-6 w-6 text-red-500" />}
        iconBg="bg-red-50"
        title="Transfer not found"
        description="This transfer request may have been cancelled or doesn't exist."
      >
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard")}
          className="w-full"
        >
          Go to Dashboard
        </Button>
      </StateCard>
    );
  }

  const transfer = transferDetails.data;

  // Expired
  if (transfer.isExpired) {
    return (
      <StateCard
        icon={<Clock className="h-6 w-6 text-amber-500" />}
        iconBg="bg-amber-50"
        title="Transfer expired"
        description={`This transfer request from ${transfer.fromUser.name || transfer.fromUser.email} has expired. Ask them to initiate a new transfer.`}
      >
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard")}
          className="w-full"
        >
          Go to Dashboard
        </Button>
      </StateCard>
    );
  }

  // Already accepted
  if (transfer.isAccepted) {
    return (
      <StateCard
        icon={<Check className="h-6 w-6 text-emerald-500" />}
        iconBg="bg-emerald-50"
        title="Transfer completed"
        description="This account transfer has already been completed."
      >
        <Button
          onClick={() => router.push("/dashboard")}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          Go to Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </StateCard>
    );
  }

  // Cancelled
  if (transfer.isCancelled) {
    return (
      <StateCard
        icon={<XCircle className="h-6 w-6 text-red-500" />}
        iconBg="bg-red-50"
        title="Transfer cancelled"
        description="This transfer request has been cancelled by the sender."
      >
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard")}
          className="w-full"
        >
          Go to Dashboard
        </Button>
      </StateCard>
    );
  }

  // Valid transfer - show accept UI
  const totalResources =
    transfer.resourceCounts.links +
    transfer.resourceCounts.customDomains +
    transfer.resourceCounts.qrCodes +
    transfer.resourceCounts.folders +
    transfer.resourceCounts.tags +
    transfer.resourceCounts.utmTemplates +
    transfer.resourceCounts.qrPresets;

  const resourceItems = [
    { icon: Link2, count: transfer.resourceCounts.links, label: "link", labelPlural: "links" },
    { icon: Globe, count: transfer.resourceCounts.customDomains, label: "domain", labelPlural: "domains" },
    { icon: QrCode, count: transfer.resourceCounts.qrCodes, label: "QR code", labelPlural: "QR codes" },
    { icon: FolderOpen, count: transfer.resourceCounts.folders, label: "folder", labelPlural: "folders" },
    { icon: Tag, count: transfer.resourceCounts.tags, label: "tag", labelPlural: "tags" },
  ].filter(item => item.count > 0);

  return (
    <div
      className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ animationFillMode: "backwards" }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-xl shadow-neutral-900/5">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-50/50 to-transparent" />

        <div className="relative p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center ring-4 ring-white shadow-lg">
                <Package className="h-10 w-10 text-blue-600" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white shadow-md flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="font-semibold text-2xl text-neutral-900 mb-2">
              Account Transfer Request
            </h1>
            <p className="text-sm text-neutral-500">
              <span className="font-medium text-neutral-700">
                {transfer.fromUser.name || "Someone"}
              </span>{" "}
              wants to transfer their account to you
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {transfer.fromUser.email}
            </p>
          </div>

          {/* Resource counts */}
          <div
            className="rounded-xl bg-neutral-50/80 border border-neutral-100 p-4 mb-5 animate-in fade-in slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-neutral-700">
                Resources to receive
              </p>
              <Badge variant="secondary" className="text-xs">
                {totalResources} total
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {resourceItems.map((item, index) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-neutral-100"
                >
                  <item.icon className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-neutral-600">
                    <span className="font-medium text-neutral-900">{item.count}</span>{" "}
                    {item.count === 1 ? item.label : item.labelPlural}
                  </span>
                </div>
              ))}
              {(transfer.resourceCounts.utmTemplates > 0 || transfer.resourceCounts.qrPresets > 0) && (
                <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-neutral-100 text-sm text-neutral-500">
                  <span>
                    + {transfer.resourceCounts.utmTemplates} UTM templates, {transfer.resourceCounts.qrPresets} QR presets
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Important notes */}
          <div
            className="space-y-2 mb-5 animate-in fade-in slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
          >
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
              Important notes
            </p>
            <ul className="space-y-1.5 text-xs text-neutral-500">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                <span>All analytics data will be preserved</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                <span>Folders and tags merged by name if they exist</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <span>Sender&apos;s account will be marked for deletion</span>
              </li>
            </ul>
          </div>

          {/* Expiry info */}
          <div
            className="flex items-center justify-center gap-2 text-xs text-neutral-400 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: "175ms", animationFillMode: "backwards" }}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>
              Expires {new Date(transfer.expiresAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Actions */}
          <div
            className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
          >
            <Button
              variant="outline"
              className="flex-1 h-11 border-neutral-200 hover:bg-neutral-50"
              onClick={() => router.push("/dashboard")}
            >
              Decline
            </Button>
            <Button
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
              onClick={handleAccept}
              disabled={acceptMutation.isLoading}
            >
              {acceptMutation.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  Accept Transfer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <p
        className="text-center text-xs text-neutral-400 mt-6 animate-in fade-in duration-500"
        style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
      >
        By accepting, all resources will be transferred to your account
      </p>
    </div>
  );
}

export default function AcceptTransferPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-white to-blue-50/30" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(212 212 212) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Decorative blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-50/50 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <div
          className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500"
          style={{ animationFillMode: "backwards" }}
        >
          <span className="text-3xl font-bold text-neutral-900 tracking-tight">
            iShortn
          </span>
        </div>

        {/* Main content */}
        <Suspense fallback={<LoadingSpinner />}>
          <AcceptTransferContent />
        </Suspense>
      </div>
    </div>
  );
}
