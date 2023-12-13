import prisma from "@/db";
import { Metadata, ResolvingMetadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import PageRenderer from "./page-renderer";

interface PageProps {
  params: { subdomain: string; path: string };
}

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const subdomain = params.subdomain;
  const path = params.path;

  const dynamicLink = await prisma.dynamicLink.findFirst({
    where: {
      subdomain,
    },
    include: {
      childLinks: {
        where: {
          shortLink: path,
        },
      },
    },
  });

  const dynamicLinkChildLink = dynamicLink?.childLinks[0];

  return {
    title:
      `${dynamicLinkChildLink?.metaDataTitle}` ||
      "Link sharing powered by ishortn",
    description:
      `${dynamicLinkChildLink?.metaDataDescription}` ||
      "Link sharing powered by ishortn",
    openGraph: {
      images: [dynamicLinkChildLink?.metaDataImageUrl as string],
    },
  };
}

const PathPage = async ({ params }: PageProps) => {
  const subdomain = params.subdomain;

  const dynamicLink = await prisma.dynamicLink.findFirst({
    where: {
      subdomain: subdomain,
    },
    include: {
      childLinks: {
        where: {
          shortLink: params.path,
        },
      },
    },
  });

  const dynamicLinkChildLink = dynamicLink?.childLinks[0];

  if (!dynamicLink) {
    notFound();
  }

  const incomingHeaders = headers();
  const userAgent = incomingHeaders.get("user-agent");

  if (userAgent?.includes("iPhone") || userAgent?.includes("iPad")) {
    redirect(dynamicLink.appStoreUrl);
  } else if (userAgent?.includes("Android")) {
    redirect(dynamicLink.playStoreUrl);
  }

  if (!dynamicLinkChildLink?.fallbackLink) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-4xl font-bold">
          This is the end of the link chain
        </div>
        <div className="text-2xl">
          Please contact the owner of this link for more information
        </div>
      </div>
    );
  }

  return (
    <PageRenderer
      domain={dynamicLinkChildLink!.fallbackLink || dynamicLinkChildLink!.link}
      ogImage={dynamicLinkChildLink!.metaDataImageUrl}
    />
  );
};

export default PathPage;
