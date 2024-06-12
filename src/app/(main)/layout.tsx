import type { ReactNode } from "react";

import { Footer } from "./footer";

const MainLayout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      {children}
      <Footer />
    </>
  );
};

export default MainLayout;
