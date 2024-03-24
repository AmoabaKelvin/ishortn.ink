import { Link } from "lucide-react";

import LinkAnalyticsStats from "@/components/dashboard/stats/stats";
import prisma from "@/db";

const LinkAnalytics = async ({ params }: { params: { alias: string } }) => {
  const linkStats = await prisma.link.findUnique({
    where: {
      alias: params.alias,
    },
    include: {
      linkVisits: true,
    },
  });

  // if the link does not have public stats enabled, redirect to the dashboard
  if (!linkStats?.publicStats) {
    return (
      <div className="flex flex-col items-center justify-center mt-20 md:mt-20">
        <h1 className="mb-10 text-3xl">iShortn</h1>
        <p className="text-2xl font-bold">Link not found</p>
        <p className="text-gray-500">
          This link <b className="text-bold">does not have</b> public stats
          enabled.
        </p>
        <p className="text-center text-gray-500">
          If you know the owner of this link, ask them to enable public stats.
        </p>

        <p className="mt-10 text-blue-500 hover:cursor-pointer">
          <a href="https://ishortn.ink" className="flex gap-1">
            Create your own Link
            <Link />
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 mx-auto max-w-7xl">
      <div className="my-10 text-center">
        <h1 className="text-2xl">Public Link Analytics</h1>
        <p className="text-gray-500">
          Brought to you by{" "}
          <a
            href="https://ishortn.ink"
            className="text-blue-500 hover:underline"
          >
            iShortn
          </a>
        </p>
      </div>
      <LinkAnalyticsStats link={linkStats} />
    </div>
  );
};

export default LinkAnalytics;
