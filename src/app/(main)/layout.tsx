import { AppProviders } from "@/components/app-providers";

import type { ReactNode } from "react";

const MainLayout = ({ children }: { children: ReactNode }) => {
  return (
    <AppProviders>
      {/* <rn-banner background-color="#2563eb" border-radius="0" margin="0" /> */}
      {children}
    </AppProviders>
  );
};

export default MainLayout;
