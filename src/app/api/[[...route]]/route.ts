import { verifyKey } from "@unkey/api";
import { Hono } from "hono";
import { prettyJSON } from "hono/pretty-json";
import { handle } from "hono/vercel";

import { domainsAPI } from "./domains";
import { dynamicLinksAPI } from "./dynamic-links";

export type Variables = {
  userID: string;
};

const app = new Hono<{ Variables: Variables }>().basePath("/api");

app.use("*", prettyJSON());

app.use("/dynamic-links/*", async (c, next) => {
  const authorizationKey = c.req.raw.headers.get("x-ishortn-key");
  if (!authorizationKey) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { error, result } = await verifyKey(authorizationKey);

  if (error) return c.text(error.message, 500);
  if (!result.valid) return c.text("Unauthorized", 401);

  c.set("userID", result.ownerId as string);
  await next();
});

app.get("/ping", async (c) => {
  return c.text("pong");
});

app.route("/dynamic-links", dynamicLinksAPI);
app.route("/domains", domainsAPI);

export const GET = handle(app);
export const POST = handle(app);
