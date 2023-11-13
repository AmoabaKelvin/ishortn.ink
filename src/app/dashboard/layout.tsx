import { Button } from "@/components/ui/button";

import { satoshi } from "@/styles/fonts";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div
      className={`px-4 py-10 mx-auto text-black max-w-7xl sm:px-6 lg:px-8 ${satoshi.className}`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-gray-800">
          <span className="text-blue-600">ishortn.ink</span> / Dashboard
        </h2>
        <Button className="w-10 h-10 rounded-full">KA</Button>
      </div>

      <div className="py-4 mt-4">{children}</div>
    </div>
  );
};

export default DashboardLayout;
