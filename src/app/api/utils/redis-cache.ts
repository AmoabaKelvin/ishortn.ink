import { env } from "@/env.mjs";
import type { Link } from "@prisma/client";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: env.UPSTASH_URL,
  token: env.UPSTASH_TOKEN,
});
