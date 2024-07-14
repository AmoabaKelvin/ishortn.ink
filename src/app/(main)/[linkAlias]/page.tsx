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

  const domain = headersList.get("x-forwarded-host") ?? headersList.get("host");

  const link = await api.link.retrieveOriginalUrl.query({
    alias: params.linkAlias,
    domain: domain!,
  });

  if (!link) return notFound();

  if (link.passwordHash) {
    return <LinkPasswordVerification id={link.id} />;
  }

  redirect(link.url!);
};

export default LinkRedirectionPage;
