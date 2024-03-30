import React from "react";

import prisma from "../../../prisma/db";

const DomainPage = () => {
  return <div>DomainPage</div>;
};

export const getServerSideProps = async ({ req, res, resolvedUrl }) => {
  const subdomains: string[] = req.headers.host.split(".");

  // if the parts of the host are more than 2, then we have a subdomain
  // in production, the host will be in the format subdomain.domain.com
  // in development, the host will be in the format domain.localhost:3000

  // to test this, it's best to run a proxy server such as serveo.net
  // this will create a subdomain for you and you can test this feature
  // then you update subdomain in the database to match the subdomain
  // that the proxy server created for you

  // e.g. if you run `ssh -R 80:localhost:3000 serveo.net`
  // you will get a subdomain such as `https://subdomain.serveo.net`
  // then you can update the subdomain in the database to `subdomain`
  // then you can test this feature

  if (subdomains.length > 2) {
    const subdomain = subdomains[0];

    const dynamicLink = await prisma.dynamicLink.findUnique({
      where: {
        subdomain,
      },
    });

    if (dynamicLink) {
      res.setHeader("Content-Type", "application/json");
      res.write(
        JSON.stringify([
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: dynamicLink.androidPackageName,
              sha256_cert_fingerprints: [dynamicLink.androidSha256Fingerprint],
            },
          },
        ]),
      );
      res.end();
    }
  }
  return {
    props: {},
  };
};

export default DomainPage;
