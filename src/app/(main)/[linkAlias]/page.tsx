import { notFound, redirect } from "next/navigation";

import { api } from "@/trpc/server";

import { LinkPasswordVerification } from "./link-password-verification";

type LinkRedirectionPageProps = {
  params: {
    linkAlias: string;
  };
};

const LinkRedirectionPage = async ({ params }: LinkRedirectionPageProps) => {
  const link = await api.link.retrieveOriginalUrl.query({
    alias: params.linkAlias,
  });

  if (!link) return notFound();

  if (link.passwordHash) {
    return <LinkPasswordVerification alias={params.linkAlias} />;
  }

  redirect(link.url!);
};

export default LinkRedirectionPage;
