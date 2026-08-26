import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { socialMediaAgents } from "@/lib/constants/app";
import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { getClientIp, getRequestGeo } from "@/lib/platform";
import { resolveShortLink } from "@/middlewares/resolve-link";
import { api } from "@/trpc/server";

import CloakedPage from "../cloaked/[url]/page";
import VerifiedRedirectPage from "../verified-redirect/[alias]/page";
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

const DEFAULT_DOMAIN = DEFAULT_PLATFORM_DOMAIN;

const cleanUrl = (url: string) => url.replace(/^(https?:\/\/)?(www\.)?/, "");

// Trust the incoming host; local dev, the staging host, and *.workers.dev
// preview hosts resolve against the default domain.
const getDomain = (incomingDomain: string | null): string => {
  if (!incomingDomain) return DEFAULT_DOMAIN;
  const host = incomingDomain.split(":")[0] ?? incomingDomain;
  if (host.includes("localhost")) return DEFAULT_DOMAIN;
  if (host === process.env.STAGING_DOMAIN) return DEFAULT_DOMAIN;
  if (host.endsWith(".workers.dev")) return DEFAULT_DOMAIN;
  return host;
};

export async function generateMetadata(props: LinkRedirectionPageProps): Promise<Metadata> {
  const params = await props.params;
  const headersList = await headers();
  const incomingDomain = headersList.get("x-forwarded-host") ?? headersList.get("host");
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
  const incomingDomain = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const userAgent = headersList.get("user-agent");
  const domain = cleanUrl(getDomain(incomingDomain));
  const alias = cleanAlias(params.linkAlias);

  if (params.linkAlias.toLowerCase().endsWith(".png")) {
    return notFound();
  }

  // OG scrapers and "!"-preview links need the link rendered, not followed —
  // neither counts as a click.
  if (isSocialMediaAgent(userAgent) || params.linkAlias.endsWith("!")) {
    const link = await api.link.retrieveOriginalUrl.query({
      alias,
      domain,
      from: "redirection",
    });

    if (!link) return notFound();
    if (link.blocked) {
      redirect(`/blocked/${link.id}`);
    }
    if (link.disabled) {
      redirect(`/expired/${link.id}`);
    }
    if (link.disableLinkAfterDate && new Date() >= link.disableLinkAfterDate) {
      redirect(`/expired/${link.id}`);
    }
    if (link.passwordHash) {
      return <LinkPasswordVerification id={link.id} />;
    }
    if (isSocialMediaAgent(userAgent)) {
      return <div>Redirecting...</div>;
    }
    return <LinkPreview link={link} />;
  }

  // Full resolution: geo rules, expiration, click recording, verified-click
  // tokens — the pipeline the pre-OpenNext middleware used to run.
  const geo = getRequestGeo();
  const resolution = await resolveShortLink({
    domain,
    alias,
    country: geo.country ?? "Unknown",
    city: geo.city ?? "Unknown",
    ip: getClientIp(headersList) ?? "",
    headers: headersList,
    baseUrl: "",
  });

  if (!resolution?.url) {
    return notFound();
  }

  // Blocked/expired/password resolutions come back as relative app routes.
  if (!resolution.url.startsWith("/")) {
    try {
      const parsed = new URL(resolution.url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return notFound();
      }
    } catch {
      return notFound();
    }
  }

  // The interstitial routes still exist for direct hits; rendering their page
  // components inline keeps the short-link URL in the address bar, which a
  // page (unlike middleware) cannot do via rewrite.
  if (resolution.cloaking) {
    return (
      <CloakedPage
        params={Promise.resolve({ url: encodeURIComponent(resolution.url) })}
        searchParams={Promise.resolve({ t: resolution.verificationToken ?? undefined })}
      />
    );
  }

  if (resolution.verificationToken) {
    return (
      <VerifiedRedirectPage
        params={Promise.resolve({ alias })}
        searchParams={Promise.resolve({ to: resolution.url, t: resolution.verificationToken })}
      />
    );
  }

  redirect(resolution.url);
};

export default LinkRedirectionPage;
