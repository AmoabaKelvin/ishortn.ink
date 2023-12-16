"use server";

import { auth } from "@clerk/nextjs";
import { Unkey } from "@unkey/api";
import Link from "next/link";
import ApiKeyCard from "./api-key-card";
import CreateAPIKey from "./create-key";

const unkey = new Unkey({ token: process.env.UNKEY_TOKEN! });

async function getUserKey(userID: string) {
  const keys = await unkey.apis.listKeys({
    ownerId: String(userID),
    apiId: process.env.UNKEY_API_ID!,
  });
  return keys;
}

const SettingsPage = async () => {
  const keys = await getUserKey(auth().userId!);

  if (keys.error) {
    return <div>Something went wrong. Please contact us.</div>;
  }

  return (
    <div>
      <div className="max-w-3xl">
        <h2 className="text-lg font-medium">API Keys</h2>
        <p className="mt-2 mb-10 text-sm text-gray-600 dark:text-gray-400">
          API Keys are used to authenticate requests to the API.{" "}
          <Link
            href="https://documenter.getpostman.com/view/21227678/2s9YkjAibQ"
            target="_blank"
            className="text-blue-600 dark:text-blue-500"
          >
            View Documentation
          </Link>
        </p>

        {keys.result?.keys.length > 0 ? (
          <ApiKeyCard
            start={keys.result?.keys[0].start!}
            createdAt={keys.result?.keys[0].createdAt!}
            keyID={keys.result?.keys[0].id!}
          />
        ) : (
          <CreateAPIKey />
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
