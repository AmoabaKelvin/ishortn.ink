import prisma from "@/db";
import { Metadata, ResolvingMetadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
type Props = {
  params: { software: string };
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const subdomain = params.software;

  const dynamicLink = await prisma.dynamicLinkChildLink.findFirst({
    where: {
      shortLink: subdomain,
    },
  });

  // get the metadata added by the user and merge it with the parent metadata
  return {
    title: `${dynamicLink?.metaDataTitle}` || "Link sharing powered by ishortn",
    description:
      `${dynamicLink?.metaDataDescription}` ||
      "Link sharing powered by ishortn",
    openGraph: {
      images: [dynamicLink?.metaDataImageUrl as string],
    },
  };
}
const RedirectionPage = async ({
  params,
}: {
  params: { software: string };
}) => {
  const subdomain = params.software;

  const resolvedDynamicLink = await prisma.dynamicLinkChildLink.findFirst({
    where: {
      shortLink: subdomain,
    },
    include: {
      dynamicLink: true,
    },
  });

  if (!resolvedDynamicLink) {
    notFound();
  }

  const dynamicLink = resolvedDynamicLink.dynamicLink;

  const incomingHeaders = headers();
  const userAgent = incomingHeaders.get("user-agent");

  if (userAgent?.includes("iPhone") || userAgent?.includes("iPad")) {
    redirect(
      dynamicLink?.appStoreUrl
        ? dynamicLink.appStoreUrl
        : `https://apps.apple.com/app/id${dynamicLink?.iosBundleId}`,
    );
  } else if (userAgent?.includes("Android")) {
    redirect(
      dynamicLink?.playStoreUrl
        ? dynamicLink.playStoreUrl
        : `https://play.google.com/store/apps/details?id=${dynamicLink?.androidPackageName}`,
    );
  }

  redirect(resolvedDynamicLink.link);
};

export default RedirectionPage;
