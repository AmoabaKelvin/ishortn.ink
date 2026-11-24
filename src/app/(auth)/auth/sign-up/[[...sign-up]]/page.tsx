import { SignUp } from "@clerk/nextjs";
import { cookies } from "next/headers";

import { SHORTEN_INTENT_COOKIE, getPostAuthUrl } from "@/lib/auth/shorten-intent";
import { formatShortenIntentForDisplay } from "@/lib/auth/shorten-intent-display";

import { siteClerkAppearance } from "../../_shared/clerk-appearance";
import { ClerkFormPlaceholder } from "../../_shared/clerk-form-placeholder";
import { PendingLinkCard, ShortenIntentHeading } from "../../_shared/shorten-intent-notice";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ "sign-up"?: string[] }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ "sign-up": step }, { next }, cookieStore] = await Promise.all([
    params,
    searchParams,
    cookies(),
  ]);
  const intent = cookieStore.get(SHORTEN_INTENT_COOKIE)?.value;
  const afterSignUpUrl = getPostAuthUrl({ next, intent });
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
            <ClerkFormPlaceholder variant="signUp" next={next} hideHeader={!!intentLabel} />
          ) : undefined
        }
        forceRedirectUrl={afterSignUpUrl}
        signInForceRedirectUrl={afterSignUpUrl}
      />
    </div>
  );
}
