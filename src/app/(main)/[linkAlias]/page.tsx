import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { api } from "@/trpc/server";

import { LinkPasswordVerification } from "./link-password-verification";

type LinkRedirectionPageProps = {
  params: {
    linkAlias: string;
  };
};

const LinkRedirectionPage = async ({ params }: LinkRedirectionPageProps) => {
  const headersList = headers();
  const incomingDomain = headersList.get("x-forwarded-host") ?? headersList.get("host");

  let domain: string;
  if (process.env.VERCEL_URL && incomingDomain !== process.env.STAGING_DOMAIN) {
    domain = incomingDomain ?? "ishortn.ink";
  } else {
    domain = "ishortn.ink";
  }

  console.log("Domain", domain);

  const link = await api.link.retrieveOriginalUrl.query({
    alias: params.linkAlias,
    domain: domain.replace("http://", "").replace("https://", "").replace("www.", ""),
  });

  if (!link) return notFound();

  if (link.passwordHash) {
    return <LinkPasswordVerification id={link.id} />;
  }

  redirect(link.url!);
};

export default LinkRedirectionPage;
