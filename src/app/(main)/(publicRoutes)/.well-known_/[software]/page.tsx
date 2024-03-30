import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { getValidSubdomain } from "../../../../../lib/utils";

export default async function Page({
  params,
}: {
  params: { software: string };
}) {
  const headersList = headers();
  console.log(headersList.get("host"));
  const subdomain = getValidSubdomain(headersList.get("host")!);

  if (!subdomain) {
    return notFound();
  }

  // return NextResponse.rewrite(
  //   "http://localhost:3000/api/assetlinks?subdomain=" + subdomain
  // );

  const fakeAssetLinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.ishortn",
        sha256_cert_fingerprints: ["fake"],
      },
    },
  ];

  return new Response(JSON.stringify(fakeAssetLinks), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
