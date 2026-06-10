import { SignIn } from "@clerk/nextjs";

import { warmClerkAppearance } from "../../_shared/clerk-appearance";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; next?: string }>;
}) {
  const { url, next } = await searchParams;
  // `next` is an internal destination to land on after auth (e.g. checkout).
  // Restrict to same-origin paths to avoid open redirects.
  const safeNext = next && /^\/(?![/\\])/.test(next) ? next : null;
  const afterSignInUrl = safeNext
    ? safeNext
    : url
      ? `/dashboard/link/new?url=${encodeURIComponent(url)}`
      : "/dashboard";

  return (
    <SignIn
      path="/auth/sign-in"
      appearance={warmClerkAppearance}
      forceRedirectUrl={afterSignInUrl}
      signUpForceRedirectUrl={afterSignInUrl}
    />
  );
}
