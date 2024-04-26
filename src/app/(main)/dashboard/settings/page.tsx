"use server";

import { auth } from "@clerk/nextjs";
import Link from "next/link";

import prisma from "@/db";

import ApiKeyCard from "./api-key-card";
import CreateAPIKey from "./create-key";

async function getUserToken(userID: string) {
  const keys = await prisma.token.findFirst({
    where: {
      userId: userID,
    },
  });

  return keys;
}

const SettingsPage = async () => {
  const keys = await getUserToken(auth().userId!);

  return (
    <div>
      <div className="max-w-3xl">
        <h2 className="text-lg font-medium">API Keys</h2>
        <p className="mt-2 mb-10 text-sm text-gray-600 dark:text-gray-400">
          API Keys are used to authenticate requests to the API.{" "}
          <Link
            href="https://ishortn.mintlify.app/introduction"
            target="_blank"
            className="text-blue-600 dark:text-blue-500"
          >
            View Documentation
          </Link>
        </p>

        {keys ? (
          <ApiKeyCard
            start={keys.token.slice(0, 7)}
            createdAt={keys.createdAt.getTime()}
            keyID={keys.id}
          />
        ) : (
          <CreateAPIKey />
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
