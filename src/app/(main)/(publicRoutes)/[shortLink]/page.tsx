import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

const RedirectionPage = async ({
  params,
}: {
  params: { shortLink: string };
}) => {
  const { shortLink } = params;

  const response = await fetch(`http://ishortn.ink/api/links/${shortLink}`, {
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
