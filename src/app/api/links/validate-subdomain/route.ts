import prisma from "@/db";

export async function GET(req: Request) {
  // the url will be in the form ?subdomain=subdomain
  const subdomain = new URL(req.url).searchParams.get("subdomain");
  console.log("Validating subdomain: ", subdomain);
  if (!subdomain) {
    return new Response("Invalid URL", { status: 400 });
  }

  const link = await prisma.dynamicLink.findUnique({
    where: {
      subdomain,
    },
  });

  if (!link) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(null, { status: 200 });
}
