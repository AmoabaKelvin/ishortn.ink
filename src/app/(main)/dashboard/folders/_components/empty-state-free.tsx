"use client";

import { Check, FolderOpen, Sparkles } from "lucide-react";
import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";

export function EmptyStateFree() {
  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
        <FolderOpen className="h-10 w-10 text-blue-600" />
      </div>

      <h3 className="mt-6 text-2xl font-semibold tracking-tight text-gray-900">
        Organize Your Links with Folders
      </h3>

      <p className="mt-2 max-w-md text-sm text-gray-500">
        Folders help you organize and manage your shortened links efficiently. 
        This is a Pro feature designed for power users.
      </p>

      <div className="mt-8 space-y-3 text-left">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
            <Check className="h-3 w-3 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              Organize links into custom folders
            </p>
            <p className="text-xs text-gray-500">
              Create unlimited folders to categorize your links by project, campaign, or client
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
            <Check className="h-3 w-3 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              Quickly find and manage related links
            </p>
            <p className="text-xs text-gray-500">
              Access all links in a folder instantly with dedicated folder views
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
            <Check className="h-3 w-3 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              Bulk move multiple links at once
            </p>
            <p className="text-xs text-gray-500">
              Save time by organizing multiple links into folders in one action
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Button 
          asChild 
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Link href="/dashboard/settings#billing">
            <Sparkles className="mr-2 h-4 w-4" />
            Upgrade to Pro
          </Link>
        </Button>
      </div>
    </div>
  );
}

