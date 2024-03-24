import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import prisma from "@/db";

const RedirectionPage = async ({
  params,
}: {
  params: { software: string };
}) => {
  const subdomain = params.software;

  const resolvedDynamicLink = await prisma.dynamicLink.findFirst({
    where: {
      subdomain: subdomain,
    },
  });

  if (!resolvedDynamicLink) {
    notFound();
  }

  const incomingHeaders = headers();
  const userAgent = incomingHeaders.get("user-agent");

  if (userAgent?.includes("iPhone") || userAgent?.includes("iPad")) {
    redirect(
      resolvedDynamicLink?.appStoreUrl
        ? resolvedDynamicLink.appStoreUrl
        : `https://apps.apple.com/app/id${resolvedDynamicLink?.iosBundleId}`,
    );
  } else if (userAgent?.includes("Android")) {
    redirect(
      resolvedDynamicLink?.playStoreUrl
        ? resolvedDynamicLink.playStoreUrl
        : `https://play.google.com/store/apps/details?id=${resolvedDynamicLink?.androidPackageName}`,
    );
  }

  return null;
};

export default RedirectionPage;
