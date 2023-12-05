import prisma from "@/db";
import { Metadata, ResolvingMetadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type Props = {
  params: { software: string };
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  // read route params
  const subdomain = params.software;

  const dynamicLink = await prisma.dynamicLink.findUnique({
    where: {
      subdomain,
    },
  });

  // get the metadata added by the user and merge it with the parent metadata
  return {
    title: `${dynamicLink?.title} | ${subdomain}`,
    description: `${dynamicLink?.description}`,
    openGraph: {
      images: [dynamicLink?.imageUrl as string],
    },
  };
}
const RedirectionPage = async ({
  params,
}: {
  params: { software: string };
}) => {
  const subdomain = params.software;

  const dynamicLink = await prisma.dynamicLink.findUnique({
    where: {
      subdomain,
    },
  });

  if (dynamicLink?.fallbackUrl) {
    redirect(dynamicLink.fallbackUrl);
  }

  // redirect to the app store or playstore
  const incomingHeaders = headers();
  const userAgent = incomingHeaders.get("user-agent");

  // check the device type
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

  if (dynamicLink?.fallbackUrl) {
    redirect(dynamicLink.fallbackUrl);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center flex-1 w-full px-20 text-center">
        {params.software} powered by ishortn.ink
      </main>
    </div>
  );
};

export default RedirectionPage;
