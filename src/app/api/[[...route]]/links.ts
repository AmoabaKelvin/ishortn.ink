import prisma from "@/db";
import { Hono, HonoRequest } from "hono";
import { UAParser } from "ua-parser-js";
import { generateShortUrl } from "../utils/links";

import {
  addLinkToRedisCache,
  retrieveLinkFromRedisCache,
} from "../utils/redis-cache";

export const linksAPI = new Hono();

linksAPI.get("/:shortLink", async (c) => {
  const defaultIPDetailsWhenWeAreInDevelopment = {
    // when we are developing, we might get the ip address ::1
    // which is the ipv6 equivalent of 127.0.0.1
    country_name: "United States",
    city: "San Francisco",
  };

  const alias = c.req.param("shortLink");

  const originalLink = await getLinkFromRedisCacheOrDatabase(alias);

  if (!originalLink || originalLink.disabled) {
    return c.text("Not Found", 404);
  }

  if (originalLink.userId) {
    const ip = getUserIP(c.req);
    let ipLocation;

    if (ip !== "::1") {
      // do not make any request when the incoming ip is ::1 (localhost)
      // we might get rate limited here, so we can have different
      // services and when one fails, we can use the other one
      ipLocation = await fetch(`https://ipapi.co/${ip}/json/`).then((res) =>
        res.json(),
      );
    } else {
      ipLocation = defaultIPDetailsWhenWeAreInDevelopment;
    }

    const userAgentDetails = parseUserAgent(c.req);

    if (
      originalLink.disableLinkAfterClicks !== null &&
      (await prisma.linkVisit.count({
        where: {
          linkId: originalLink.id,
        },
      })) >= originalLink.disableLinkAfterClicks!
    ) {
      await prisma.link.update({
        where: {
          id: originalLink.id,
        },
        data: {
          disabled: true,
        },
      });
      return c.text("Not Found", 404);
    }

    // this should not prevent the user from visiting the link

    try {
      await prisma.linkVisit.create({
        data: {
          // sometimes the linkId can either be a string or a number depending on where
          // it was obtained from (redis or the database) so we have to convert it to a number
          linkId: Number(originalLink.id),
          os: userAgentDetails.os || "Unknown",
          browser: userAgentDetails.browser || "Unknown",
          device: userAgentDetails.device,
          model: userAgentDetails.model,
          city: ipLocation.city,
          country: ipLocation.country_name,
        },
      });
    } catch (e) {
      // do something with the error
      // todo: do something with the error
    }
  }

  return c.json({ url: originalLink.url });
});

linksAPI.post("/", async (c) => {
  const { alias, url } = await c.req.json();

  if (!url) {
    return c.text("Invalid URL", 400);
  }

  const existingLink = await prisma.link.findFirst({
    where: {
      url: url.toString(),
    },
  });

  // check if an alias was provided
  if (!alias && existingLink) {
    return c.json(
      JSON.stringify({
        url: `https://ishortn.ink/${existingLink.alias}`,
      }),
    );
  }

  if (alias && existingLink && existingLink.alias === alias) {
    return c.json(
      JSON.stringify({
        url: `https://ishortn.ink/${alias}`,
      }),
    );
  }

  const link = await prisma.link.create({
    data: {
      alias: alias || (await generateShortUrl(url)),
      url,
    },
  });

  return c.json(
    JSON.stringify({
      url: `https://ishortn.ink/${link.alias}`,
    }),
  );
});

// helpers
const getUserIP = (req: HonoRequest) => {
  let forwardedFor = req.raw.headers.get("x-forwarded-for");
  let realIp = req.raw.headers.get("x-real-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  if (realIp) {
    return realIp.trim();
  }

  return null;
};

const parseUserAgent = (req: HonoRequest) => {
  // sometimes the device type is not detected correctly,
  // that is, you can get an os name of Mac OS and a device type of undefined
  // so we have to manually map the os name to the device type
  const deviceTypeMap = {
    iOS: "Mobile",
    Android: "Mobile",
    "Mac OS": "Desktop",
    Windows: "Desktop",
  };

  const ua = new UAParser(req.raw.headers.get("user-agent")!);

  const os = ua.getOS().name;
  const browser = ua.getBrowser().name;
  const device =
    (ua.getDevice().type ?? deviceTypeMap[os as keyof typeof deviceTypeMap]) ||
    "Unknown";
  const model = ua.getDevice().model;

  return {
    os,
    browser,
    device,
    model,
  };
};
const getLinkFromRedisCacheOrDatabase = async (alias: string) => {
  // this will try to retrieve the link from the redis cache
  // if it is not found, it will retrieve it from the database
  // and then add it to the redis cache
  const retrievedLink = await retrieveLinkFromRedisCache(alias);

  if (retrievedLink) {
    console.log("Cache hit");
    return retrievedLink;
  }

  const originalLink = await prisma.link.findUnique({
    where: {
      alias: alias,
    },
  });

  if (!originalLink) {
    return null;
  }

  await addLinkToRedisCache(originalLink);

  return originalLink;
};
