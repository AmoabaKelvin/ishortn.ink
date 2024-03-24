import LinkAnalyticsStats from "@/components/dashboard/stats/stats";
import prisma from "@/db";
import { auth } from "@clerk/nextjs";

const LinkAnalytics = async ({ params }: { params: { alias: string } }) => {
  const linkStats = await prisma.link.findUnique({
    where: {
      alias: params.alias,
      userId: auth().userId,
    },
    include: {
      linkVisits: true,
    },
  });

  if (!linkStats) {
    return <p>Link not found</p>;
  }

  return <LinkAnalyticsStats link={linkStats} />;
};

export default LinkAnalytics;
