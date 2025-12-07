"use client";

import { FolderOpen, FolderPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

type EmptyStateProProps = {
  onCreateClick: () => void;
};

export function EmptyStatePro({ onCreateClick }: EmptyStateProProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50/50 p-8 text-center animate-in fade-in-50">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
        <FolderOpen className="h-10 w-10 text-blue-600" />
      </div>

      <h3 className="mt-6 text-2xl font-semibold tracking-tight">
        No folders yet
      </h3>

      <p className="mt-2 mb-8 max-w-sm text-sm text-muted-foreground">
        Create your first folder to start organizing your links. Group links by
        project, campaign, or any way that works for you.
      </p>

      <Button onClick={onCreateClick} className="bg-blue-600 hover:bg-blue-700">
        <FolderPlus className="mr-2 h-4 w-4" />
        Create Folder
      </Button>
    </div>
  );
}
