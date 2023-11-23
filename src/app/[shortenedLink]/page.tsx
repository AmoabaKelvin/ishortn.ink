import { headers } from "next/headers";
import { redirect } from "next/navigation";

import axios from "axios";

export const dynamic = "force-dynamic";

const getTheOriginalLink = async (shortenedLink: string) => {
  const host = process.env.HOST;
  // const incomingHeaders = headers();

  const response = await fetch(host + `/api/links?alias=${shortenedLink}`, {
    method: "GET",
    headers: headers(),
    cache: "no-cache",
    // headers: headers(),
  });

  if (!response.ok) {
    // throw new Error("Something went wrong");
  }
  const data = await response.json();
  return data.url;
};

const RedirectionPage = async ({
  params,
}: {
  params: { shortenedLink: string };
}) => {
  const { shortenedLink } = params;
  const originalLink = await getTheOriginalLink(shortenedLink);
  return redirect(originalLink);
};

export default RedirectionPage;
