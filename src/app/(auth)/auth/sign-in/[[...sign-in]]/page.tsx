import { SignIn } from "@clerk/nextjs";
import { cookies } from "next/headers";

import { env } from "@/env.mjs";
import { SHORTEN_INTENT_COOKIE, getPostAuthUrl, toSameOriginPath } from "@/lib/auth/shorten-intent";
import { formatShortenIntentForDisplay } from "@/lib/auth/shorten-intent-display";

import { siteClerkAppearance } from "../../_shared/clerk-appearance";
import { ClerkFormPlaceholder } from "../../_shared/clerk-form-placeholder";
import { ShortenIntentNotice } from "../../_shared/shorten-intent-notice";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ "sign-in"?: string[] }>;
  searchParams: Promise<{ next?: string; redirect_url?: string }>;
}) {
  const [{ "sign-in": step }, { next, redirect_url: redirectUrl }, cookieStore] = await Promise.all(
    [params, searchParams, cookies()],
  );
  const intent = cookieStore.get(SHORTEN_INTENT_COOKIE)?.value;
  const afterSignInUrl = getPostAuthUrl({
    next,
    redirectUrl,
    intent,
    appUrl: env.NEXT_PUBLIC_APP_URL,
  });
  // The placeholder's footer link to the other auth page keeps the destination until Clerk mounts.
  const footerNext = next ?? toSameOriginPath(redirectUrl, env.NEXT_PUBLIC_APP_URL) ?? undefined;
  const intentLabel = formatShortenIntentForDisplay(intent);

  return (
    <>
      {intentLabel && (
        <ShortenIntentNotice lead="Sign in to get your short link for" url={intentLabel} />
      )}
      <SignIn
        path="/auth/sign-in"
        appearance={siteClerkAppearance}
        // The placeholder is the start step; later steps (factor-one, sso-callback, verify-…)
        // render a different card, so they get no stand-in.
        fallback={
          step?.length ? undefined : <ClerkFormPlaceholder variant="signIn" next={footerNext} />
        }
        forceRedirectUrl={afterSignInUrl}
        signUpForceRedirectUrl={afterSignInUrl}
      />
    </>
  );
}
