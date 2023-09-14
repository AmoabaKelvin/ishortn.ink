import * as Queries from "./queries";

const BASE_URL = "ishortn.ink";

export async function POST(req: Request) {
  const { url, alias } = await req.json();

  if (!url) {
    return new Response("Invalid URL", { status: 400 });
  }

  const existingUrl = await Queries.getLink(url);
  if (alias && existingUrl && existingUrl.alias === alias) {
    return new Response(JSON.stringify({ url: `${BASE_URL}/${alias}` }));
  }

  const newLink = await Queries.insertLink(url, alias);
  return new Response(JSON.stringify({ url: `${BASE_URL}/${newLink}` }));
}

export async function GET(req: Request) {
  const alias = new URL(req.url).searchParams.get("alias");

  if (!alias) {
    return new Response("Invalid URL", { status: 400 });
  }

  const existingUrl = await Queries.retrieveShortenedLink(alias);

  if (existingUrl) {
    return new Response(JSON.stringify({ url: existingUrl }));
  }

  return new Response("Not Found", { status: 404 });
}
