import { AppProviders } from "@/components/app-providers";
import { MicrosoftClarityScript } from "@/components/scripts/clarity";
import { Toaster } from "@/components/ui/sonner";

import type { ReactNode } from "react";

const MainLayout = ({ children }: { children: ReactNode }) => {
  return (
    <AppProviders>
      {/* Session replay for the signed-in app only (PostHog's slim build has no replay). Kept off
          marketing and auth pages, where its main-thread cost slows first load. */}
      <MicrosoftClarityScript />
      {/* <rn-banner background-color="#2563eb" border-radius="0" margin="0" /> */}
      {children}
      {/* Without an explicit dir, Sonner reads getComputedStyle(<html>) while hydrating, which
          forces a style recalculation of the whole page inside that task. */}
      <Toaster dir="ltr" />
    </AppProviders>
  );
};

export default MainLayout;
