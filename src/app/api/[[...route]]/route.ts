import { Hono } from "hono";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { handle } from "hono/vercel";

import { verifyToken } from "@/lib/utils/tokens";

import { domainsAPI } from "./domains";
import { dynamicLinksAPI } from "./dynamic-links";
import { linksAPI } from "./links";

export type Variables = {
  userID: string;
};

const app = new Hono<{ Variables: Variables }>().basePath("/api");

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST"],
    allowHeaders: ["x-ishortn-key", "Content-Type"],
  }),
);
app.use("*", prettyJSON());

app.use("/dynamic-links/*", async (c, next) => {
  const token = c.req.raw.headers.get("x-ishortn-key");
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await verifyToken(token);

  if (!result) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userID", result.userId);

  await next();
});

app.get("/ping", async (c) => {
  return c.text("pong");
});

app.route("/dynamic-links", dynamicLinksAPI);
app.route("/domains", domainsAPI);
app.route("/links", linksAPI);

export const GET = handle(app);
export const POST = handle(app);
