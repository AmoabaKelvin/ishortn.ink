"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { daysSinceDate } from "@/lib/utils";

import type { RouterOutputs } from "@/trpc/shared";

type FolderCardProps = {
  folder: RouterOutputs["folder"]["list"][number];
  onEdit: (folder: RouterOutputs["folder"]["list"][number]) => void;
  onDelete: (folder: RouterOutputs["folder"]["list"][number]) => void;
};

export function FolderCard({ folder, onEdit, onDelete }: FolderCardProps) {
  const router = useTransitionRouter();

  const handleCardClick = () => {
    router.push(`/dashboard/folders/${folder.id}`);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(folder);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(folder);
  };

  const daysSinceFolderCreation = daysSinceDate(folder.createdAt ?? new Date());

  return (
    <Card
      className="flex flex-col rounded-md px-6 py-4 cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex cursor-pointer items-center text-blue-600 hover:underline">
              <span className="font-semibold">{folder.name}</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-1 flex-wrap">
            <span>
              {daysSinceFolderCreation === 0
                ? "Today"
                : `${daysSinceFolderCreation}d`}
            </span>
            <span className="text-slate-300">•</span>
            <span>
              {folder.linkCount} {folder.linkCount === 1 ? "link" : "links"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={handleEditClick}
            className="h-8 w-8"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={handleDeleteClick}
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
