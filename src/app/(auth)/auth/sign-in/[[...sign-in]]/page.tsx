import { SignIn } from "@clerk/nextjs";

import { warmClerkAppearance } from "../../_shared/clerk-appearance";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  const afterSignInUrl = url
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
