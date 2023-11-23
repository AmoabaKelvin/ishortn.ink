import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const getTheOriginalLink = async (shortenedLink: string) => {
  const host = process.env.HOST;
  const incomingHeaders = headers();

  const response = await fetch(host + `/api/links?alias=${shortenedLink}`, {
    cache: "no-cache",
    headers: { ...incomingHeaders },
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
