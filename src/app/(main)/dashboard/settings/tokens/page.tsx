import { Link } from "next-view-transitions";

import { api } from "@/trpc/server";

import GenerateTokenTrigger from "./create-token";
import TokenCard from "./token-card";

export default async function ApiTokenPage() {
  const tokens = await api.token.list.query();
  const token = tokens[0];

  return (
    <div>
      <div className="max-w-3xl">
        <h2 className="text-lg font-medium">API Keys</h2>
        <p className="mb-10 mt-2 text-sm text-gray-600 dark:text-gray-400">
          API Keys are used to authenticate requests to the API.{" "}
          <Link
            href="https://ishortn.mintlify.app/introduction"
            target="_blank"
            className="text-blue-600 dark:text-blue-500"
          >
            View Documentation
          </Link>
        </p>

        {tokens.length > 0 ? (
          <TokenCard
            start="******"
            createdAt={token!.createdAt!.getTime()}
            keyID={token!.id}
          />
        ) : (
          <GenerateTokenTrigger />
        )}
      </div>
    </div>
  );
}
