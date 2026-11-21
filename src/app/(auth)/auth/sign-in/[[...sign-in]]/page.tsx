import { SignIn } from "@clerk/nextjs";
import { cookies } from "next/headers";

import { SHORTEN_INTENT_COOKIE, getPostAuthUrl } from "@/lib/auth/shorten-intent";

import { siteClerkAppearance } from "../../_shared/clerk-appearance";
import { ClerkFormPlaceholder } from "../../_shared/clerk-form-placeholder";

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const afterSignInUrl = getPostAuthUrl({
    next,
    intent: cookieStore.get(SHORTEN_INTENT_COOKIE)?.value,
  });

  return (
    <SignIn
      path="/auth/sign-in"
      appearance={siteClerkAppearance}
      fallback={<ClerkFormPlaceholder variant="signIn" next={next} />}
      forceRedirectUrl={afterSignInUrl}
      signUpForceRedirectUrl={afterSignInUrl}
    />
  );
}
