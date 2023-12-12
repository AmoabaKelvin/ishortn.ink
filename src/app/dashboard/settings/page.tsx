"use server";

import { auth } from "@clerk/nextjs";
import { Unkey } from "@unkey/api";
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

  return (
    <div>
      <div className="max-w-3xl">
        <h2 className="text-lg font-medium">API Keys</h2>
        <p className="mt-2 mb-10 text-sm text-gray-600 dark:text-gray-400">
          API Keys are used to authenticate requests to the API.
        </p>

        {keys.result?.total! > 0 ? (
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

// ishortn_3ZZhmQUSjRzvfZKcLx78mTSu
