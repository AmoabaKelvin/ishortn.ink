"use client";

import { useAuth } from "@clerk/nextjs";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Loader2,
  Shield,
  User,
  Users,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const roleConfig = {
  owner: {
    icon: Shield,
    label: "Owner",
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  admin: {
    icon: Shield,
    label: "Admin",
    className: "text-violet-700 bg-violet-50 border-violet-200",
  },
  member: {
    icon: User,
    label: "Member",
    className: "text-neutral-600 bg-neutral-50 border-neutral-200",
  },
};

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
        {/* Decorative gradient */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neutral-50 to-transparent" />

        <div className="relative text-center">
          {/* Icon */}
          <div
            className={cn(
              "inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5",
              iconBg
            )}
          >
            {icon}
          </div>

          {/* Text */}
          <h1 className="font-display text-xl text-neutral-900 mb-2">{title}</h1>
          <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
            {description}
          </p>

          {/* Actions */}
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
        <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-neutral-900 border-t-transparent animate-spin" />
      </div>
    </div>
  );
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();
  const token = searchParams.get("token");

  const inviteDetails = api.team.getInviteByToken.useQuery(
    { token: token! },
    {
      enabled: !!token && isSignedIn,
    }
  );

  const baseDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "ishortn.ink";

  const acceptInviteMutation = api.team.acceptInvite.useMutation({
    onSuccess: (data) => {
      toast.success(`Joined ${data.teamName}`);
      window.location.href = `${window.location.protocol}//${data.teamSlug}.${baseDomain}/dashboard`;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAcceptInvite = () => {
    if (token) {
      acceptInviteMutation.mutate({ token });
    }
  };

  // No token
  if (!token) {
    return (
      <StateCard
        icon={<AlertCircle className="h-6 w-6 text-red-500" />}
        iconBg="bg-red-50"
        title="Invalid invite"
        description="This invite link is incomplete or malformed."
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
        icon={<Users className="h-6 w-6 text-neutral-600" />}
        iconBg="bg-neutral-100"
        title="Sign in to continue"
        description="You need to sign in to accept this team invitation."
      >
        <Button
          onClick={() =>
            router.push(
              `/auth/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`
            )
          }
          className="w-full bg-neutral-900 hover:bg-neutral-800"
        >
          Sign in
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </StateCard>
    );
  }

  // Loading invite
  if (inviteDetails.isLoading) {
    return <LoadingSpinner />;
  }

  // Invite not found
  if (!inviteDetails.data) {
    return (
      <StateCard
        icon={<AlertCircle className="h-6 w-6 text-red-500" />}
        iconBg="bg-red-50"
        title="Invite not found"
        description="This invite may have been revoked or doesn't exist."
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

  const invite = inviteDetails.data;
  const config = roleConfig[invite.role];
  const RoleIcon = config.icon;

  // Expired
  if (invite.isExpired) {
    return (
      <StateCard
        icon={<Clock className="h-6 w-6 text-amber-500" />}
        iconBg="bg-amber-50"
        title="Invite expired"
        description={`This invitation to ${invite.team.name} has expired. Ask the team admin to send a new one.`}
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
  if (invite.isAccepted) {
    return (
      <StateCard
        icon={<Check className="h-6 w-6 text-emerald-500" />}
        iconBg="bg-emerald-50"
        title="Already a member"
        description="You're already part of this team."
      >
        <div className="space-y-2 w-full">
          <Button
            onClick={() =>
              (window.location.href = `${window.location.protocol}//${invite.team.slug}.${baseDomain}/dashboard`)
            }
            className="w-full bg-neutral-900 hover:bg-neutral-800"
          >
            Go to team
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="w-full text-neutral-500"
          >
            Personal dashboard
          </Button>
        </div>
      </StateCard>
    );
  }

  // Valid invite - show accept UI
  return (
    <div
      className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ animationFillMode: "backwards" }}
    >
      {/* Card */}
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-xl shadow-neutral-900/5">
        {/* Decorative top gradient */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-neutral-50 to-transparent" />

        {/* Content */}
        <div className="relative p-8">
          {/* Team Avatar */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Avatar className="h-20 w-20 ring-4 ring-white shadow-lg">
                <AvatarImage
                  src={invite.team.avatarUrl ?? undefined}
                  alt={invite.team.name}
                />
                <AvatarFallback className="bg-gradient-to-br from-neutral-100 to-neutral-200 text-neutral-700 text-2xl font-semibold">
                  {invite.team.name[0]?.toUpperCase() ?? "T"}
                </AvatarFallback>
              </Avatar>
              {/* Team badge */}
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-white shadow-md flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-neutral-600" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl text-neutral-900 mb-2">
              Join {invite.team.name}
            </h1>
            <p className="text-sm text-neutral-500">
              {invite.invitedBy?.name || "A team member"} invited you to
              collaborate
            </p>
          </div>

          {/* Details */}
          <div
            className="rounded-xl bg-neutral-50/80 border border-neutral-100 p-4 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Team</span>
                <span className="text-sm font-medium text-neutral-900">
                  {invite.team.name}
                </span>
              </div>
              <div className="h-px bg-neutral-200/60" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Workspace</span>
                <span className="text-xs font-mono text-neutral-600 bg-white px-2 py-1 rounded border border-neutral-200/60">
                  {invite.team.slug}.{baseDomain}
                </span>
              </div>
              <div className="h-px bg-neutral-200/60" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Your role</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                    config.className
                  )}
                >
                  <RoleIcon className="h-3 w-3" />
                  {config.label}
                </span>
              </div>
            </div>
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
              className="flex-1 h-11 bg-neutral-900 hover:bg-neutral-800 shadow-lg shadow-neutral-900/10"
              onClick={handleAcceptInvite}
              disabled={acceptInviteMutation.isLoading}
            >
              {acceptInviteMutation.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  Accept invite
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
        By accepting, you'll get access to the team's links and analytics
      </p>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-white to-neutral-100" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(212 212 212) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Decorative blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-100/30 rounded-full blur-3xl" />

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
          <AcceptInviteContent />
        </Suspense>
      </div>
    </div>
  );
}
