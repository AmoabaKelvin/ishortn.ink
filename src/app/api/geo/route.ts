import { geolocation, ipAddress } from "@vercel/functions";

export function GET(request: Request) {
  const details = geolocation(request);
  const ip = ipAddress(request);
  return Response.json({ ...details, ip });
}
