import NavigationBar from "@/components/dashboard/navigation-bar";

import { satoshi } from "@/styles/fonts";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div
      className={`px-4 py-10 mx-auto text-black max-w-7xl sm:px-6 lg:px-8 ${satoshi.className}`}
    >
      <NavigationBar />

      <div className="py-4 mt-4">{children}</div>
    </div>
  );
};

export default DashboardLayout;
