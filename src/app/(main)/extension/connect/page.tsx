import { auth } from "@clerk/nextjs/server";
import { IconAlertTriangle, IconCheck, IconX } from "@tabler/icons-react";
import { eq } from "drizzle-orm";
import { Funnel_Sans } from "next/font/google";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { env } from "@/env.mjs";
import {
  connectResultUrl,
  parseConnectParams,
  parseRedirectUriList,
} from "@/lib/extension/connect";
import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { ensureUser } from "@/server/lib/ensure-user";

import { connectExtension } from "./actions";
import { ConnectButton } from "./connect-button";

import type { ConnectRequest } from "@/lib/extension/connect";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Connect the browser extension",
  robots: { index: false, follow: false },
};

// Per-request: the page reads the session, and its answer must never be cached (next.config.js
// also sends no-store, no-referrer and DENY framing for /extension).
export const dynamic = "force-dynamic";

const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  variable: "--font-funnel-sans",
  weight: ["400", "700"],
});

const CAN = [
  "Create short links in your personal workspace",
  "Read your recent links and this month's usage",
];
const CANNOT = [
  "See your browsing. It only reads the tab you shorten, when you click it",
  "Change your account, billing or other links",
];

function connectPath(request: ConnectRequest) {
  const params = new URLSearchParams({ redirect_uri: request.redirectUri, state: request.state });
  if (request.label) params.set("label", request.label);
  return `/extension/connect?${params.toString()}`;
}

export default async function ExtensionConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Checked before anything else, so an unknown redirect URI is never sent anywhere.
  const parsed = parseConnectParams(
    await searchParams,
    parseRedirectUriList(env.EXTENSION_REDIRECT_URIS),
  );
  if (!parsed.ok) {
    return (
      <ConnectShell>
        <ConnectError
          title="This connect link isn't valid"
          description="Open the iShortn extension and click Connect iShortn again. If this keeps happening, update the extension."
        />
      </ConnectShell>
    );
  }

  const { userId } = await auth();
  if (!userId) {
    redirect(`/auth/sign-up?next=${encodeURIComponent(connectPath(parsed.request))}`);
  }

  // A brand-new account may reach this page before the Clerk webhook has created its row.
  const access = await ensureUser(userId);
  if (!access || access.banned || access.deletedAt) {
    return (
      <ConnectShell>
        <ConnectError
          title="This account can't connect the extension"
          description="Your account is suspended or closed. Contact support@ishortn.ink if you think this is a mistake."
        />
      </ConnectShell>
    );
  }

  const owner = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { email: true },
  });
  const { redirectUri, state, label } = parsed.request;

  return (
    <ConnectShell>
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
          <ViewfinderMark />
        </div>
        <h1 className="mt-4 text-[14px] font-semibold text-neutral-900 dark:text-foreground">
          Connect the iShortn browser extension
          {owner?.email && (
            <>
              {" "}
              to <span className="break-words">{owner.email}</span>
            </>
          )}
          ?
        </h1>
        {label && (
          <p className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">{label}</p>
        )}
      </div>

      <div className="mt-5 space-y-4 border-t border-neutral-100 pt-5 dark:border-border/50">
        <PermissionList title="It can" items={CAN} allowed />
        <PermissionList title="It can't" items={CANNOT} allowed={false} />
      </div>

      <form action={connectExtension} className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="state" value={state} />
        {label && <input type="hidden" name="label" value={label} />}
        <Button
          asChild
          variant="outline"
          className="h-9 flex-1 border-neutral-200 text-[13px] dark:border-border"
        >
          <a href={connectResultUrl(redirectUri, { error: "access_denied", state })}>Cancel</a>
        </Button>
        <ConnectButton />
      </form>

      <p className="mt-4 text-center text-[12px] text-neutral-400 dark:text-muted-foreground">
        You can disconnect it at any time in Settings.
      </p>
    </ConnectShell>
  );
}

function ConnectShell({ children }: { children: ReactNode }) {
  return (
    <main
      className={cn(
        "flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-10 dark:bg-accent/50",
        funnelSans.className,
      )}
    >
      <Card className="w-full max-w-[400px] rounded-xl border-neutral-200 p-5 shadow-none sm:p-6 dark:border-border">
        {children}
      </Card>
    </main>
  );
}

function ConnectError({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
        <IconAlertTriangle size={20} stroke={1.5} className="text-red-600 dark:text-red-400" />
      </div>
      <h1 className="mt-4 text-[14px] font-semibold text-neutral-900 dark:text-foreground">
        {title}
      </h1>
      <p className="mt-1 max-w-xs text-[13px] text-neutral-500 dark:text-neutral-400">
        {description}
      </p>
    </div>
  );
}

function PermissionList({
  title,
  items,
  allowed,
}: {
  title: string;
  items: string[];
  allowed: boolean;
}) {
  const Icon = allowed ? IconCheck : IconX;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-muted-foreground">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-[13px] text-neutral-700 dark:text-neutral-300"
          >
            <Icon
              size={14}
              stroke={2}
              aria-hidden="true"
              className={cn(
                "mt-0.5 shrink-0",
                allowed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-neutral-400 dark:text-muted-foreground",
              )}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ViewfinderMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-1.231 -1.231 34.462 34.462"
      fill="none"
      aria-hidden="true"
      className="h-6 w-6"
    >
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14V8a4 4 0 0 1 4-4h6" />
        <path d="M28 18v6a4 4 0 0 1-4 4h-6" />
      </g>
      <rect x="11" y="11" width="10" height="10" rx="3" fill="currentColor" />
    </svg>
  );
}
