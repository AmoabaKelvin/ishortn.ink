"use client";

import { revokeAPIKey } from "@/actions/api-keys";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";

const ApiKeyCard = ({
  start,
  createdAt,
  keyID,
}: {
  start: string;
  createdAt: number;
  keyID: string;
}) => {
  const [loading, startTransition] = useTransition();

  const handleKeyRevoke = () => {
    startTransition(async () => {
      await revokeAPIKey(keyID);
    });
  };
  return (
    <div className="flex flex-col p-3 border rounded-md">
      <div className="flex justify-between">
        <span>Key</span>
        <span>
          <code>{start}</code>
        </span>
      </div>
      <div className="flex justify-between">
        <span>Created</span>
        <span>
          {new Date(createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </div>
      <div className="flex justify-end mt-5">
        <Button
          variant={"destructive"}
          onClick={handleKeyRevoke}
          disabled={loading}
        >
          Revoke Key
        </Button>
      </div>
    </div>
  );
};

export default ApiKeyCard;
