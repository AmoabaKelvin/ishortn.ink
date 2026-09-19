import "@/styles/site.css";
import "@/styles/site-auth.css";
import { Link } from "next-view-transitions";

import { Wordmark } from "../../(landing)/_components/site-primitives";

import type { ReactNode } from "react";

// Wordmark (ours) → Clerk tray: white card with Clerk's header + form, footer strip.
// Clerk styling: ./_shared/clerk-appearance.ts + src/styles/site-auth.css
const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div data-theme="site" className="relative isolate min-h-screen overflow-hidden">
      <div aria-hidden="true" className="site-dots pointer-events-none absolute inset-0" />
      <main className="relative grid min-h-screen place-items-center px-4 py-12">
        <div className="w-full max-w-[28rem]">
          <Link href="/" aria-label="Homepage" className="mx-auto mb-8 flex w-fit">
            <Wordmark />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AuthLayout;
