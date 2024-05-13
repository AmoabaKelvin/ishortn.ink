import { Hono } from "hono";

import prisma from "@/db";
import { getDeviceAndGeolocationDetails } from "@/lib/utils/analytics";
import {
  generateShortLink,
  hasLinkExceededSpecifiedClicks,
  hasLinkExceededSpecifiedDate,
  retrieveLinkFromCacheOrDatabase,
} from "@/lib/utils/links";
import { validateUrl } from "@/lib/utils/links/validation";

export const linksAPI = new Hono();

linksAPI.get("/:shortLink", async (c) => {
  const alias = c.req.param("shortLink");

  const originalLink = await retrieveLinkFromCacheOrDatabase(alias);

  if (!originalLink || originalLink.disabled) {
    return c.text("Not Found", 404);
  }

  if (!originalLink.userId) {
    return c.json({ url: originalLink.url });
  }

  if (
    (await hasLinkExceededSpecifiedClicks(originalLink)) ||
    (await hasLinkExceededSpecifiedDate(originalLink))
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

  try {
    const { os, browser, device, model, city, country } =
      await getDeviceAndGeolocationDetails(c.req);

    await prisma.linkVisit.create({
      data: {
        linkId: Number(originalLink.id),
        os,
        browser,
        device,
        model,
        city,
        country,
      },
    });
  } catch (e) {
    console.log(e);
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

  const isLinkSafe = await validateUrl(url);

  if (!isLinkSafe) {
    return c.text("Unsafe URL", 400);
  }

  const link = await prisma.link.create({
    data: {
      alias: alias || (await generateShortLink()),
      url,
    },
  });

  return c.json(
    JSON.stringify({
      url: `https://ishortn.ink/${link.alias}`,
    }),
  );
});
