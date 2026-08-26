import { getClientIp, getRequestGeo } from "@/lib/platform";

export function GET(request: Request) {
  const details = getRequestGeo();
  const ip = getClientIp(request.headers);
  return Response.json({ ...details, ip });
}
