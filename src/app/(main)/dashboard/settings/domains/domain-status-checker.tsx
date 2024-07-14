"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

interface DomainStatusCheckerProps {
  domain: string;
  initialStatus: "pending" | "active" | "invalid";
  onStatusChange: (newStatus: "pending" | "active" | "invalid") => void;
}

export default function DomainStatusChecker({
  domain,
  initialStatus,
  onStatusChange,
}: DomainStatusCheckerProps) {
  const [isChecking, setIsChecking] = useState(false);

  const checkDomainStatus = api.customDomain.checkStatus.useQuery(
    { domain },
    {
      refetchInterval: 30000,
      onSettled: () => {
        setIsChecking(false);
      },
      onSuccess: (data) => {
        onStatusChange(data.status as "pending" | "active" | "invalid");
      },
    },
  );

  const handleManualCheck = async () => {
    setIsChecking(true);
    await checkDomainStatus.refetch();
  };

  return (
    <div>
      <Button
        onClick={handleManualCheck}
        disabled={isChecking || checkDomainStatus.isLoading || checkDomainStatus.isFetching}
      >
        {isChecking || checkDomainStatus.isLoading || checkDomainStatus.isFetching
          ? "Checking..."
          : "Check Now"}
      </Button>
    </div>
  );
}
