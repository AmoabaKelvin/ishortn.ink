import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const DashboardEmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Image
        src="/images/empty-archive.png"
        alt="Empty State"
        width={150}
        height={150}
      />
      <h1 className="mt-4 text-lg font-semibold text-gray-800">
        You don&apos;t have any links yet.
      </h1>
      <Button asChild variant="secondary" className="mt-4">
        <Link href="/dashboard/links">Shorten your first link</Link>
      </Button>
    </div>
  );
};

export default DashboardEmptyState;
