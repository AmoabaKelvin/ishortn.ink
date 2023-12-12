import { createDynamicLinkChildLink } from "@/actions/dynamic-links-actions";
import prisma from "@/db";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import { Variables } from "./route";

export const dynamicLinksAPI = new Hono<{ Variables: Variables }>();

const DynamicLinkChildLinkSchema = z.object({
  projectSubdomain: z.string().url(),
  metaData: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
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

    const createdLink = await createDynamicLinkChildLink(
      {
        link: link.link,
        shortLink: "",
        fallbackLink: link.fallbackLink || "",
        metaDataDescription: link.metaData.description,
        metaDataImageUrl: link.metaData.imageUrl,
        metaDataTitle: link.metaData.title,
      },
      dynamicLinkProject.id,
      undefined,
      userID,
    );

    return c.json(
      {
        url: `https://${subdomain}.ishortn.ink/${createdLink!.shortLink}`,
      },
      201,
    );
  },
);

// const formatDataToReturn = (
//   data: Omit<Prisma.DynamicLinkChildLinkSelect, "id" | "createdAt">,
//   subdomain: string,
// ) => {
//   return {
//     // id: data.id,
//     link: data.link,
//     shortLink: data.shortLink,
//     completeUrl: `https://${subdomain}.ishortn.ink/${data.shortLink}`,
//     fallbackLink: data.fallbackLink,
//     metaData: {
//       description: data.metaDataDescription,
//       imageUrl: data.metaDataImageUrl,
//       title: data.metaDataTitle,
//     },
//   };
// };
