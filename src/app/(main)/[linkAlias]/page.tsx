import { notFound, redirect } from "next/navigation";

import { api } from "@/trpc/server";

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

  redirect(link.url!);
};

export default LinkRedirectionPage;
