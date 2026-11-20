import { headers } from "next/headers";

import { isPlatformHost } from "./utils";

/** Whether this request is on a platform short domain (vs a customer's own). */
export async function isPlatformRequest(): Promise<boolean> {
  const headersList = await headers();
  return isPlatformHost(headersList.get("x-forwarded-host") ?? headersList.get("host"));
}
