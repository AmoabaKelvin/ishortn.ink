import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { socialMediaAgents } from "@/lib/constants/app";
import { api } from "@/trpc/server";

import { LinkPasswordVerification } from "./link-password-verification";
import LinkPreview from "./link-preview";

import type { Metadata } from "next";

type LinkRedirectionPageProps = {
  params: Promise<{
    linkAlias: string;
  }>;
};

export type LinkMetadata = {
  title: string;
  description: string;
  image: string;
};

const DEFAULT_DOMAIN = "ishortn.ink";

const cleanUrl = (url: string) => url.replace(/^(https?:\/\/)?(www\.)?/, "");

const getDomain = (incomingDomain: string | null): string => {
  if (process.env.VERCEL_URL && incomingDomain !== process.env.STAGING_DOMAIN) {
    return incomingDomain ?? DEFAULT_DOMAIN;
  }
  return DEFAULT_DOMAIN;
};

export async function generateMetadata(
  props: LinkRedirectionPageProps
): Promise<Metadata> {
  const params = await props.params;
  const headersList = await headers();
  const incomingDomain =
    headersList.get("x-forwarded-host") ?? headersList.get("host");
  const domain = getDomain(incomingDomain);

  if (params.linkAlias.toLowerCase().endsWith(".png")) {
    return {};
  }

  const link = await api.link.retrieveOriginalUrl.query({
    alias: cleanAlias(params.linkAlias),
    domain: cleanUrl(domain),
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

const isSocialMediaAgent = (userAgent: string | null): boolean =>
  socialMediaAgents.some((agent) => userAgent?.includes(agent));

const cleanAlias = (incomingAlias: string): string => {
  let alias = incomingAlias;
  if (alias.endsWith("!")) {
    alias = alias.slice(0, -1);
  }
  return alias.toLowerCase();
};

const LinkRedirectionPage = async (props: LinkRedirectionPageProps) => {
  const params = await props.params;
  const headersList = await headers();
  const incomingDomain =
    headersList.get("x-forwarded-host") ?? headersList.get("host");
  const userAgent = headersList.get("user-agent");
  const domain = getDomain(incomingDomain);

  if (params.linkAlias.endsWith(".png")) {
    return notFound();
  }

  const link = await api.link.retrieveOriginalUrl.query({
    alias: cleanAlias(params.linkAlias),
    domain: cleanUrl(domain),
    from: "redirection",
  });

  if (!link) return notFound();

  if (link.passwordHash) {
    return <LinkPasswordVerification id={link.id} />;
  }

  if (isSocialMediaAgent(userAgent)) {
    return <div>Redirecting...</div>;
  }

  if (params.linkAlias.endsWith("!")) {
    return <LinkPreview link={link} />;
  }

  redirect(link.url!);
};

export default LinkRedirectionPage;
