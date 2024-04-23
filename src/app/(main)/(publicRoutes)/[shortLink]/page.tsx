import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { env } from "@/env.mjs";

const RedirectionPage = async ({
  params,
}: {
  params: { shortLink: string };
}) => {
  const { shortLink } = params;

  const url = env.VERCEL_URL ? `https://ishortn.ink` : env.HOST;

  const response = await fetch(`${url}/api/links/${shortLink}`, {
    headers: new Headers(headers()),
    cache: "no-cache",
  });

  const data = await response.json();

  if (response.status === 200) {
    redirect(data.url);
  } else {
    return notFound();
  }
};

export default RedirectionPage;
