import { UAParser } from "ua-parser-js";
import * as Queries from "./queries";

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

function getUserIP(req: Request) {
  return (
    req.headers.get("x-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-client-ip") ||
    req.headers.get("x-forwarded") ||
    req.headers.get("forwarded-for") ||
    req.headers.get("forwarded") ||
    req.headers.get("remote-addr")
  );
}

export async function GET(req: Request) {
  const alias = new URL(req.url).searchParams.get("alias");
  const ip = getUserIP(req);

  if (!alias) {
    return new Response("Invalid URL", { status: 400 });
  }

  const retrievedLink = await prisma.link.findUnique({
    where: {
      alias: alias.replaceAll('"', ""),
    },
  });

  if (!retrievedLink || retrievedLink.disabled) {
    return new Response("Not Found", { status: 404 });
  }

  if (retrievedLink?.userId) {
    const userAgent = req.headers.get("user-agent");
    const parser = new UAParser(userAgent!);
    const userAgentDetails = parser.getResult();

    const ipLocation = await fetch(`https://ipapi.co/${ip}/json/`).then((res) =>
      res.json(),
    );

    if (
      retrievedLink.disableLinkAfterClicks !== 0 &&
      (await prisma.linkVisit.count({
        where: {
          linkId: retrievedLink.id,
        },
      })) >= retrievedLink.disableLinkAfterClicks!
    ) {
      await prisma.link.update({
        where: {
          id: retrievedLink.id,
        },
        data: {
          disabled: true,
        },
      });
      return new Response("Not Found", { status: 404 });
    }

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
