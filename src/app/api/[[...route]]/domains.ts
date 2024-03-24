import { Hono } from "hono";

import prisma from "@/db";

export const domainsAPI = new Hono();

domainsAPI.get("/", async (c) => {
  const { subdomain } = c.req.query();

  if (!subdomain) {
    return c.text("Invalid URL", 400);
  }

  const link = await prisma.dynamicLink.findUnique({
    where: {
      subdomain,
    },
  });

  if (!link) {
    return c.text("Not Found", 404);
  }

  return c.json({ link });
});
