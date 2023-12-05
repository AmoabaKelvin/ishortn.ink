// For some reason, we could not send the json back to the client from the middleware
// so we had to create a page for this using the pages directory because the app
// directory could not send the json back to the client.

import { getValidSubdomain } from "../../lib/utils";

import prisma from "../../../prisma/db";

import React from "react";

const AssertLinksPage = () => {
  return <div>AssertLinksPage</div>;
};

export default AssertLinksPage;

export const getServerSideProps = async ({ req, res, resolvedUrl }) => {
  const subdomain = getValidSubdomain(req.headers.host);
  // now we can use the subdomain to fetch the app details from the database
  // and return the assetlinks.json file

  if (!subdomain) {
    return {
      props: {},
    };
  }

  const dynamicLink = await prisma.dynamicLink.findUnique({
    where: {
      subdomain,
    },
  });

  res.setHeader("Content-Type", "application/json");
  res.write(
    JSON.stringify([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: dynamicLink!.androidPackageName,
          sha256_cert_fingerprints: [dynamicLink!.androidSha256Fingerprint],
        },
      },
    ]),
  );
  res.end();
  return {
    props: {},
  };
};
