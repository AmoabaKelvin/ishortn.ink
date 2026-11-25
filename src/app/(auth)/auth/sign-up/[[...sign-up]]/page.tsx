import { SignUp } from "@clerk/nextjs";
import { cookies } from "next/headers";

import { env } from "@/env.mjs";
import { SHORTEN_INTENT_COOKIE, getPostAuthUrl, toSameOriginPath } from "@/lib/auth/shorten-intent";
import { formatShortenIntentForDisplay } from "@/lib/auth/shorten-intent-display";

import { siteClerkAppearance } from "../../_shared/clerk-appearance";
import { ClerkFormPlaceholder } from "../../_shared/clerk-form-placeholder";
import { PendingLinkCard, ShortenIntentHeading } from "../../_shared/shorten-intent-notice";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ "sign-up"?: string[] }>;
  searchParams: Promise<{ next?: string; redirect_url?: string }>;
}) {
  const [{ "sign-up": step }, { next, redirect_url: redirectUrl }, cookieStore] = await Promise.all(
    [params, searchParams, cookies()],
  );
  const intent = cookieStore.get(SHORTEN_INTENT_COOKIE)?.value;
  const afterSignUpUrl = getPostAuthUrl({
    next,
    redirectUrl,
    intent,
    appUrl: env.NEXT_PUBLIC_APP_URL,
  });
  // The placeholder's footer link to the other auth page keeps the destination until Clerk mounts.
  const footerNext = next ?? toSameOriginPath(redirectUrl, env.NEXT_PUBLIC_APP_URL) ?? undefined;
  const intentLabel = formatShortenIntentForDisplay(intent);
  const isStart = !step?.length;

  return (
    // data-shorten-intent swaps Clerk's start-step header for ours (src/styles/site-auth.css)
    <div data-shorten-intent={intentLabel && isStart ? "" : undefined}>
      {intentLabel && isStart && <ShortenIntentHeading />}
      {intentLabel && <PendingLinkCard url={intentLabel} showNote={isStart} />}
      <SignUp
        path="/auth/sign-up"
        appearance={siteClerkAppearance}
        // The placeholder is the start step; later steps (factor-one, sso-callback, verify-…)
        // render a different card, so they get no stand-in.
        fallback={
          isStart ? (
            <ClerkFormPlaceholder variant="signUp" next={footerNext} hideHeader={!!intentLabel} />
          ) : undefined
        }
        forceRedirectUrl={afterSignUpUrl}
        signInForceRedirectUrl={afterSignUpUrl}
      />
    </div>
  );
}
