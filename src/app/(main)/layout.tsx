import type { ReactNode } from "react";

const MainLayout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      {/* <rn-banner background-color="#2563eb" border-radius="0" margin="0" /> */}
      {children}
    </>
  );
};

export default MainLayout;
