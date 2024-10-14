import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { socialMediaAgents } from "@/lib/constants";
import { api } from "@/trpc/server";

import { LinkPasswordVerification } from "./link-password-verification";

import type { Metadata } from "next";

type LinkRedirectionPageProps = {
  params: {
    linkAlias: string;
  };
};

type LinkMetadata = {
  title: string;
  description: string;
  image: string;
};

export async function generateMetadata({
  params,
}: LinkRedirectionPageProps): Promise<Metadata> {
  const headersList = headers();
  const incomingDomain =
    headersList.get("x-forwarded-host") ?? headersList.get("host");

  let domain: string;
  if (process.env.VERCEL_URL && incomingDomain !== process.env.STAGING_DOMAIN) {
    domain = incomingDomain ?? "ishortn.ink";
  } else {
    domain = "ishortn.ink";
  }

  const link = await api.link.retrieveOriginalUrl.query({
    alias: params.linkAlias,
    domain: domain
      .replace("http://", "")
      .replace("https://", "")
      .replace("www.", ""),
    from: "metadata",
  });

  const linkMetadata = link?.metadata as LinkMetadata;

  return {
    title: { absolute: linkMetadata?.title ?? "" },
    description: linkMetadata?.description ?? "",
    openGraph: { images: [linkMetadata?.image ?? ""] },
    twitter: {
      card: "summary_large_image",
      site: linkMetadata?.title ?? "",
      title: linkMetadata?.title ?? "",
      description: linkMetadata?.description ?? "",
      images: [linkMetadata?.image ?? ""],
    },
  };
}

function isSocialMediaAgent(userAgent: string | null): boolean {
  return socialMediaAgents.some((agent) => userAgent?.includes(agent));
}

const LinkRedirectionPage = async ({ params }: LinkRedirectionPageProps) => {
  const headersList = headers();
  const incomingDomain =
    headersList.get("x-forwarded-host") ?? headersList.get("host");
  const userAgent = headers().get("user-agent");

  let domain: string;
  if (process.env.VERCEL_URL && incomingDomain !== process.env.STAGING_DOMAIN) {
    domain = incomingDomain ?? "ishortn.ink";
  } else {
    domain = "ishortn.ink";
  }

  const link = await api.link.retrieveOriginalUrl.query({
    alias: params.linkAlias,
    domain: domain
      .replace("http://", "")
      .replace("https://", "")
      .replace("www.", ""),
    from: "redirection",
  });

  if (!link) return notFound();

  if (link.passwordHash) {
    return <LinkPasswordVerification id={link.id} />;
  }

  if (isSocialMediaAgent(userAgent)) {
    return <div>Redirecting...</div>;
  }

  redirect(link.url!);
};

export default LinkRedirectionPage;
