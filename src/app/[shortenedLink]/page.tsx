import { redirect } from "next/navigation";

const getTheOriginalLink = async (shortenedLink: string) => {
  const host = process.env.HOST;
  const response = await fetch(host + "/api/links?url=" + shortenedLink);
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
