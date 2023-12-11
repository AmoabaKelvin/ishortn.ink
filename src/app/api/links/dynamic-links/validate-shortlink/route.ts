import { checkShortURLIsAvailableForProject } from "@/lib/utils";

export async function GET(req: Request) {
  const projectID = new URL(req.url).searchParams.get("projectID");
  const shortLink = new URL(req.url).searchParams.get("shortLink");

  if (!projectID || !shortLink) {
    return new Response("Invalid URL", { status: 400 });
  }

  const response = await checkShortURLIsAvailableForProject(
    shortLink,
    Number(projectID),
  );

  if (!response) {
    return new Response("Not Available", { status: 400 });
  }

  return new Response(null, { status: 200 });
}
