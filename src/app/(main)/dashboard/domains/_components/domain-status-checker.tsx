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
      className="rounded-md py-1 bg-slate-50 font-normal cursor-pointer hover:bg-slate-100 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        if (!isLoading) {
          handleManualCheck();
        }
      }}
    >
      <RefreshCw className={`h-4 w-4 mr-1 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? "Checking..." : "Check Now"}
    </Badge>
  );
}
