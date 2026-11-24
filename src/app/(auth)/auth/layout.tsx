import "@/styles/site.css";
import "@/styles/site-auth.css";
import { Link } from "next-view-transitions";

import { FirstTouchCapture } from "@/components/attribution/first-touch-capture";
import { AuthProviders } from "@/components/auth-providers";
import { getClerkScripts } from "@/lib/auth/clerk-scripts";

import { Wordmark } from "../../(landing)/_components/site-primitives";

import type { ReactNode } from "react";

// Wordmark (ours) → Clerk tray: white card with Clerk's header + form, footer strip.
// Clerk styling: ./_shared/clerk-appearance.ts + src/styles/site-auth.css
const AuthLayout = ({ children }: { children: ReactNode }) => {
  const clerkOrigin = getClerkScripts()?.origin;

  return (
    <div data-theme="site" className="relative isolate min-h-screen overflow-hidden">
      {/* Hoisted into <head>. Clerk's <script crossorigin> opens a connection without
          credentials; its API calls send cookies and need their own, which this opens while the
          scripts download instead of after. */}
      {clerkOrigin && <link rel="preconnect" href={clerkOrigin} />}
      <FirstTouchCapture />
      <div aria-hidden="true" className="site-dots pointer-events-none absolute inset-0" />
      <main className="relative grid min-h-screen place-items-center px-4 py-12">
        <div className="w-full max-w-[28rem]">
          <Link href="/" aria-label="Homepage" className="mx-auto mb-8 flex w-fit">
            <Wordmark />
          </Link>
          <AuthProviders>{children}</AuthProviders>
        </div>
      </main>
    </div>
  );
};

export default AuthLayout;
