import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";

import prisma from "@/db";
import { generateShortLinkForProject } from "@/lib/utils";

import { Variables } from "./route";

export const dynamicLinksAPI = new Hono<{ Variables: Variables }>();

const DynamicLinkChildLinkSchema = z.object({
  projectSubdomain: z.string().url(),
  metaData: z.object({
    title: z.string().max(191).optional(),
    description: z.string().max(191).optional(),
    imageUrl: z.string().url().optional(),
  }),
  link: z.string().url(),
  fallbackLink: z.string().url().optional(),
  createdFromUI: z.boolean().default(false),
});

dynamicLinksAPI.get("/", async (c) => {
  return c.json({
    message: "Hello, dynamic links!",
  });
});

dynamicLinksAPI.get("/:shortUrl", async (c) => {
  const { shortUrl } = c.req.param();
  const userID = c.get("userID");

  const dynamicLinkProject = await prisma.dynamicLink.findFirst({
    where: {
      user: {
        id: userID,
      },
    },
    include: {
      childLinks: {
        where: {
          shortLink: shortUrl,
        },
      },
    },
  });

  if (!dynamicLinkProject || !dynamicLinkProject.childLinks.length) {
    return c.text("Not found!", 404);
  }

  return c.json(
    {
      url: dynamicLinkProject.childLinks[0].link,
    },
    200,
  );
});

dynamicLinksAPI.post(
  "/",
  validator("json", (value, c) => {
    const parsed = DynamicLinkChildLinkSchema.safeParse(value);
    if (!parsed.success) {
      return c.text("Invalid!", 401);
    }
    return parsed.data;
  }),
  async (c) => {
    const { projectSubdomain, ...link } = c.req.valid("json");
    const userID = c.get("userID");
    const subdomain = projectSubdomain.split(".")[0].replace("https://", "");

    const dynamicLinkProject = await prisma.dynamicLink.findFirst({
      where: {
        user: {
          id: userID,
        },
        subdomain: subdomain,
      },
    });

    if (!dynamicLinkProject) {
      return c.text("Not found!", 404);
    }

    const linkIsAlreadyCreated = await prisma.dynamicLinkChildLink.findFirst({
      where: {
        link: link.link,
        dynamicLinkId: dynamicLinkProject.id,
      },
    });

    if (linkIsAlreadyCreated) {
      return c.json(
        {
          url: `https://${subdomain}.ishortn.ink/${linkIsAlreadyCreated.shortLink}`,
        },
        200,
      );
    }

    const shortLink = await generateShortLinkForProject(
      link.link,
      dynamicLinkProject.id,
    );

    const createdLink = await prisma.dynamicLinkChildLink.create({
      data: {
        link: link.link,
        shortLink: shortLink,
        fallbackLink: link.fallbackLink || "",
        metaDataDescription: link.metaData.description,
        metaDataImageUrl: link.metaData.imageUrl || "",
        metaDataTitle: link.metaData.title,
        dynamicLink: {
          connect: {
            id: dynamicLinkProject.id,
          },
        },
      },
    });

    return c.json(
      {
        url: `https://${subdomain}.ishortn.ink/${createdLink!.shortLink}`,
      },
      201,
    );
  },
);
