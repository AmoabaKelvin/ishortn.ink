import { auth } from "@clerk/nextjs";
import { PrismaClient } from "@prisma/client";
import LinkAnalyticsStats from "./stats";

const db = new PrismaClient();

const LinkAnalytics = async ({ params }: { params: { alias: string } }) => {
  const linkStats = await db.link.findUnique({
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
