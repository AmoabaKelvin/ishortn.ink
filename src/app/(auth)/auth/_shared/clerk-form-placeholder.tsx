import { Link } from "next-view-transitions";

import { PostHogHold } from "@/components/scripts/posthog";
import { clerkLocalization } from "@/lib/auth/clerk-localization";
import { cn } from "@/lib/utils";

import { AuthFormReady } from "./auth-form-ready";

// Server-rendered stand-in for Clerk's <SignIn/>/<SignUp/> card, shown until Clerk's scripts
// have loaded and mounted the real form. Every row has the height Clerk gives it under
// ./clerk-appearance.ts and src/styles/site-auth.css, so the form replaces it without moving
// the page. Line heights are Clerk's unitless ones: a px value rounds differently and adds up
// to a visible shift. Re-measure `.cl-cardBox` against this after changing either file or the
// instance's sign-in/sign-up fields. PostHog waits until Clerk has swapped it out, and the swap is
// reported as auth_form_ready.

const variants = {
  signUp: {
    ...clerkLocalization.signUp.start,
    fields: ["Email address", "Password"],
    footerText: "Already have an account?",
    footerLink: { label: "Sign in", href: "/auth/sign-in" },
  },
  signIn: {
    ...clerkLocalization.signIn.start,
    fields: ["Email address"],
    footerText: "Don’t have an account?",
    footerLink: { label: "Sign up", href: "/auth/sign-up" },
  },
};

const pendingFill = "animate-pulse bg-neutral-950/[0.06] motion-reduce:animate-none";

export function ClerkFormPlaceholder({
  variant,
  next,
  hideHeader = false,
}: {
  variant: keyof typeof variants;
  next?: string;
  // Matches the form under [data-shorten-intent], where the page renders its own heading
  hideHeader?: boolean;
}) {
  const { title, subtitle, fields, footerText, footerLink } = variants[variant];
  const footerHref = next
    ? `${footerLink.href}?${new URLSearchParams({ next }).toString()}`
    : footerLink.href;

  return (
    <div aria-busy="true" className="flex flex-col rounded-[28px] bg-neutral-50 shadow-site-card">
      <PostHogHold />
      <AuthFormReady page={variant === "signUp" ? "sign-up" : "sign-in"} />
      {/* White card (.cl-card) */}
      <div className="-mx-px -mt-px flex flex-col gap-8 rounded-[28px] bg-white px-6 py-10 shadow-site-card sm:px-10">
        {!hideHeader && (
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-title text-2xl font-semibold leading-[1.41176] tracking-[-0.035em] text-neutral-900">
              {title}
            </h1>
            <p className="text-base leading-[1.38462] text-neutral-600">{subtitle}</p>
          </div>
        )}
        <div aria-hidden="true" className="flex flex-col gap-6">
          <div className={cn("h-11 rounded-[10px]", pendingFill)} />
          <div className="flex items-center">
            <div className="h-px flex-1 bg-neutral-950/[0.07]" />
            <span className="mx-4 text-sm leading-[1.38462] text-neutral-600">or</span>
            <div className="h-px flex-1 bg-neutral-950/[0.07]" />
          </div>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-6">
              {fields.map((label) => (
                <div key={label} className="flex flex-col gap-2">
                  <span className="text-sm font-medium leading-[1.38462] text-neutral-900">
                    {label}
                  </span>
                  {/* Pending, not input-styled: taps here do nothing until Clerk mounts */}
                  <div className={cn("h-11 rounded-[10px]", pendingFill)} />
                </div>
              ))}
            </div>
            <div className={cn("h-11 rounded-[10px]", pendingFill)} />
          </div>
        </div>
      </div>

      {/* Footer strip (.cl-footerAction, .cl-footerItem) */}
      <p className="flex justify-center gap-1 px-6 py-5 text-base leading-[1.38462] text-neutral-600 sm:text-sm sm:leading-[1.38462]">
        {footerText}
        <Link href={footerHref} className="font-medium text-neutral-900 hover:underline">
          {footerLink.label}
        </Link>
      </p>
      <div
        aria-hidden="true"
        className="flex h-[49px] items-center border-t border-neutral-950/[0.07] px-8"
      >
        <div className={cn("h-3 w-20 rounded-full", pendingFill)} />
      </div>
    </div>
  );
}
