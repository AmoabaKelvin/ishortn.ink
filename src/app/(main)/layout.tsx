import type { ReactNode } from "react";

import { Footer } from "./footer";

const MainLayout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <rn-banner background-color="#2563eb" border-radius="0" margin="0" />
      {children}
      <Footer />
    </>
  );
};

export default MainLayout;
