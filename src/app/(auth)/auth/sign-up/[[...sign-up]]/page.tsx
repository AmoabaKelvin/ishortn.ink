import { SignUp } from "@clerk/nextjs";

import { warmClerkAppearance } from "../../_shared/clerk-appearance";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  const afterSignUpUrl = url
    ? `/dashboard/link/new?url=${encodeURIComponent(url)}`
    : "/dashboard";

  return (
    <SignUp
      path="/auth/sign-up"
      appearance={warmClerkAppearance}
      forceRedirectUrl={afterSignUpUrl}
      signInForceRedirectUrl={afterSignUpUrl}
    />
  );
}
