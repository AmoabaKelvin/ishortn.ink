"use client";

import { IconRefresh } from "@tabler/icons-react";
import { useState } from "react";

import { api } from "@/trpc/react";

interface DomainStatusCheckerProps {
  domain: string;
  initialStatus: "pending" | "active" | "invalid";
  onStatusChange: (newStatus: "pending" | "active" | "invalid") => void;
}

export default function DomainStatusChecker({ domain, onStatusChange }: DomainStatusCheckerProps) {
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

  const isLoading = isChecking || checkDomainStatus.isLoading || checkDomainStatus.isFetching;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!isLoading) {
          handleManualCheck();
        }
      }}
      disabled={isLoading}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-blue-600 transition-colors hover:bg-blue-50"
    >
      <IconRefresh size={12} stroke={1.5} className={isLoading ? "animate-spin" : ""} />
      {isLoading ? "Checking..." : "Check Now"}
    </button>
  );
}
