import * as Queries from "./queries";

import { headers } from "next/headers";

import { UAParser } from "ua-parser-js";

import prisma from "@/db";
import { someKnownDesktopDevices } from "../utils";

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
  const incomingHeaders = headers();
  console.log(">>> User agent", incomingHeaders.get("user-agent"));
  console.log(">>> User IP agent", incomingHeaders.get("cf-connecting-ip"));
  console.log(">>> User IP agent", incomingHeaders.get("x-real-ip"));

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

  // Log the referer

  if (!alias) {
    return new Response("Invalid URL", { status: 400 });
  }

  const retrievedLink = await prisma.link.findUnique({
    where: {
      alias: alias.replaceAll('"', ""),
    },
  });

  console.log(">>> Retrieved link", retrievedLink);

  if (!retrievedLink) {
    return new Response("Not Found", { status: 404 });
  }

  if (retrievedLink?.userId) {
    const referer = req.headers.get("referer");
    console.log(">>> Referer", referer);

    const userAgent = req.headers.get("user-agent");
    const parser = new UAParser(userAgent!);
    const userAgentDetails = parser.getResult();

    const ipLocation = await fetch(`https://ipapi.co/${ip}/json/`).then((res) =>
      res.json()
    );
    console.log("User is logged in", retrievedLink.userId);
    // TODO: Add user tracking
    console.log(">>> User tracking");
    await prisma.linkVisit.create({
      data: {
        linkId: retrievedLink.id,
        os: userAgentDetails.os.name || "Unknown",
        browser: userAgentDetails.browser.name || "Unknown",
        device:
          userAgentDetails.device.type ||
          someKnownDesktopDevices.includes(userAgentDetails.os.name!)
            ? "Desktop"
            : "Unknown",
        model: userAgentDetails.device.model || "Unknown",
        country: ipLocation.country_name || "Unknown",
        city: ipLocation.city || "Unknown",
      },
    });
  }

  // return Response.redirect(retrievedLink.url, 301);
  return new Response(JSON.stringify(retrievedLink));
}
