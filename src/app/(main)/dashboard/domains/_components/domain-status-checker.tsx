"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
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
    <Badge
      variant="outline"
      className="rounded-lg py-1.5 px-2.5 bg-gray-50 border-gray-200 font-normal cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        if (!isLoading) {
          handleManualCheck();
        }
      }}
    >
      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-blue-500 ${isLoading ? 'animate-spin' : ''}`} />
      <span className="text-gray-700 font-medium text-xs">
        {isLoading ? "Checking..." : "Check Now"}
      </span>
    </Badge>
  );
}
