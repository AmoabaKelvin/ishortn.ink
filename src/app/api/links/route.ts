import * as Queries from "./queries";

import * as platform from "platform";

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

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
  console.log(">>> URL", req.url);
  const alias = new URL(req.url).searchParams.get("alias");

  // Ip address
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-client-ip") ||
    req.headers.get("x-forwarded") ||
    req.headers.get("forwarded-for") ||
    req.headers.get("forwarded") ||
    req.headers.get("remote-addr");

  console.log(">>> IP", ip);

  // Print the location of the IP address
  const ipLocation = await fetch(`https://ipapi.co/${ip}/json/`).then((res) =>
    res.json()
  );

  console.log(">>> IP Location", ipLocation);

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

  console.log(">>> User details", userDetails);

  if (!alias) {
    return new Response("Invalid URL", { status: 400 });
  }

  const retrievedLink = await db.link.findUnique({
    where: {
      alias: alias.replaceAll('"', ""),
    },
  });

  console.log(">>> Retrieved link", retrievedLink);

  if (!retrievedLink) {
    return new Response("Not Found", { status: 404 });
  }

  if (retrievedLink?.userId) {
    console.log("User is logged in", retrievedLink.userId);
    // TODO: Add user tracking
    console.log(">>> User tracking");
    await db.linkVisit.create({
      data: {
        linkId: retrievedLink.id,
        os: userDetails.os?.family || "Unknown",
        browser: userDetails.name || "Unknown",
        device: platformMapToDeviceType[userDetails.os?.family!] || "Unknown",
        country: ipLocation.country_name || "Unknown",
        city: ipLocation.city || "Unknown",
      },
    });
  }

  // return Response.redirect(retrievedLink.url, 301);
  return new Response(JSON.stringify({ url: retrievedLink }));
}
