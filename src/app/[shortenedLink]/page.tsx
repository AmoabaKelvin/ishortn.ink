import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const getTheOriginalLink = async (shortenedLink: string) => {
  const host = process.env.HOST;
  const response = await fetch(
    "https://www.ishortn.ink" + `/api/links?alias=${shortenedLink}`,
    {
      cache: "no-cache",
      headers: headers(),
    },
  );
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
