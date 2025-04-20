"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

type AnalyticsHeaderProps = {
  domain: string;
  alias: string;
};

const AnalyticsHeader = ({ domain, alias }: AnalyticsHeaderProps) => {
  return (
    <div className="flex items-center gap-3">
      <h1 className="font-semibold leading-tight text-blue-600 cursor-pointer hover:underline md:text-3xl">
        {domain}/{alias}
      </h1>
      <CopyIcon
        className="w-4 h-4 cursor-pointer hover:text-blue-600 transition-all duration-200 text-gray-500"
        onClick={() => {
          navigator.clipboard.writeText(`https://${domain}/${alias}`);
          toast.success("Copied to clipboard");
        }}
      />
    </div>
  );
};

export default AnalyticsHeader;
