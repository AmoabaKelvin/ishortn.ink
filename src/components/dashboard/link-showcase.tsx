"use client";

import { LinkActions } from "@/components/dashboard/link-showcase-dropdown";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";

const LinkShowcase = () => {
  const { toast } = useToast();
  return (
    <div className="flex items-center justify-between px-6 py-4 rounded-md bg-slate-50">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <p className="flex items-center text-blue-600 cursor-pointer hover:underline">
            <span className="inline-block w-2 h-2 mr-2 bg-blue-300 rounded-full animate-pulse"></span>
            ishortn.ink/sth
          </p>
          <div className="flex items-center justify-center w-6 h-6 bg-white rounded-full cursor-pointer hover:animate-wiggle-more ">
            <Copy
              className="w-3 h-3"
              onClick={() => {
                window.navigator.clipboard.writeText("https://ishortn.com/");
                toast({
                  description: "The link has been copied to your clipboard",
                });
              }}
            />
          </div>
        </div>
        <p className="text-sm text-gray-500">
          <span>7d</span>
          <span className="mx-1 text-slate-300">•</span>
          <span className="text-gray-900 cursor-pointer hover:underline">
            https://example.com
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="transition-all duration-500 rounded-md bg-slate-100 hover:scale-110"
        >
          20 Clicks
        </Badge>

        <LinkActions />
      </div>
    </div>
  );
};

export default LinkShowcase;
