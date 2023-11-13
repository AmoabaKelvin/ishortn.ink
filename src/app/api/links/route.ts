import * as Queries from "./queries";

import * as platform from "platform";

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
  // console.log(req);
  console.log(">>> User agent", req.headers.get("user-agent"));

  const userDetails = platform.parse(req.headers.get("user-agent") || "");

  const platformMapToDeviceType: Record<string, string> = {
    // Add index signature
    iOS: "mobile",
    "OS X": "desktop",
    iPad: "tablet",
    iPod: "mobile",
    "Windows Phone": "mobile",
    Windows: "desktop",
    "Mac OS": "desktop",
    Linux: "desktop",
    Android: "mobile",
    BlackBerry: "mobile",
    "Chrome OS": "desktop",
    "PlayStation 4": "console",
    "Nintendo Switch": "console",
    "Xbox One": "console",
    Xbox: "console",
  };

  console.log({
    platform: userDetails.os,
    browser: userDetails.name,
    version: userDetails.version,
    product: userDetails.product,
    manufacturer: userDetails.manufacturer,
    stringified: userDetails.toString(),
    deviceType: platformMapToDeviceType[userDetails.os?.family!],
  });

  if (!alias) {
    return new Response("Invalid URL", { status: 400 });
  }

  const existingUrl = await Queries.retrieveShortenedLink(alias);

  if (existingUrl) {
    return new Response(JSON.stringify({ url: existingUrl }));
  }

  return new Response("Not Found", { status: 404 });
}
