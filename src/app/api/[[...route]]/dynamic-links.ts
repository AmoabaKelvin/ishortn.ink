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

/**
 * @swagger
 * /api/dynamic-links/{shortUrl}:
 *   get:
 *     summary: Get the original URL behind a short dynamic link
 *     description: This endpoint takes a short dynamic link and returns the original URL it is pointing to, along with the user ID associated with the link.
 *     parameters:
 *       - in: path
 *         name: shortUrl
 *         required: true
 *         type: string
 *         description: The short URL to resolve.
 *     responses:
 *       200:
 *         description: The original URL behind the short link.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: The original URL associated with the short link.
 *       404:
 *         description: If the short URL is not found or does not belong to the user.
 *         content:
 *           text/plain:
 *             example: Not found!
 */
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

/**
 * @swagger
 * /api/dynamic-links:
 *   post:
 *     summary: Create a new dynamic link within a project
 *     requestBody:
 *       required: true
 *       content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *                 link:
 *                   type: string
 *                   description: The original URL the link points to.
 *                   example: https://a-domain-your-app-can-handle.com
 *                 fallbackLink:
 *                   type: string
 *                   description: The optional fallback URL to open on unsupported platforms.
 *                   example: https://a-web-version-of-your-app.com
 *                   optional: true
 *                 metaData:
 *                   type: object
 *                   description: The link's metadata.
 *                   optional: true
 *                   properties:
 *                     description:
 *                       type: string
 *                       description: The description of the link.
 *                       example: A bag of chips.
 *                     imageUrl:
 *                       type: string
 *                       description: The URL of an image to display for the link.
 *                       example: https://a-bag-of-chips.png
 *                     title:
 *                       type: string
 *                       description: The title of the link.
 *                       example: Buy a bag of chips!
 *     responses:
 *       201:
 *         description: The url of the newly created dynamic link link.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: The URL of the newly created dynamic link child link.
 *                   example: https://subdomain.ishortn.ink/shortLink
 *       401:
 *         description: Invalid request body format or invalid link data.
 *         content:
 *           text/plain:
 *             example: {"code":"invalid_type","expected":"string","received":"number","path":["link"]}
 *       404:
 *         description: The provided project subdomain doesn't exist for the user.
 *         content:
 *           text/plain:
 *             example: Not found!
 */

dynamicLinksAPI.post(
  "/",
  validator("json", (value, c) => {
    const parsed = DynamicLinkChildLinkSchema.safeParse(value);
    if (!parsed.success) {
      return c.text(JSON.stringify(parsed.error), 401);
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
