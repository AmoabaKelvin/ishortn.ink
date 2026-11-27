import { getPaddleClient } from "@/lib/paddle/client";
import { getPaddleConfig } from "@/lib/paddle/config";

import { handlePaddleWebhook } from "./handler";

// 404 until Paddle is configured, so the route is inert while Lemon Squeezy is the only provider.
export function POST(request: Request) {
  return handlePaddleWebhook(request, { config: getPaddleConfig(), client: getPaddleClient() });
}
