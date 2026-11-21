import { SignIn } from "@clerk/nextjs";
import { cookies } from "next/headers";

import { SHORTEN_INTENT_COOKIE, getPostAuthUrl } from "@/lib/auth/shorten-intent";
import { formatShortenIntentForDisplay } from "@/lib/auth/shorten-intent-display";

import { siteClerkAppearance } from "../../_shared/clerk-appearance";
import { ShortenIntentNotice } from "../../_shared/shorten-intent-notice";

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const intent = cookieStore.get(SHORTEN_INTENT_COOKIE)?.value;
  const afterSignInUrl = getPostAuthUrl({ next, intent });
  const intentLabel = formatShortenIntentForDisplay(intent);

  return (
    <>
      {intentLabel && (
        <ShortenIntentNotice lead="Sign in to get your short link for" url={intentLabel} />
      )}
      <SignIn
        path="/auth/sign-in"
        appearance={siteClerkAppearance}
        forceRedirectUrl={afterSignInUrl}
        signUpForceRedirectUrl={afterSignInUrl}
      />
    </>
  );
}
