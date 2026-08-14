import { getClientIp, getRequestGeo } from "@/lib/platform";

export function GET(request: Request) {
  const details = getRequestGeo(request);
  const ip = getClientIp(request);
  return Response.json({ ...details, ip });
}
