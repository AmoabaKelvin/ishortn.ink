import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { notFound } from "next/navigation";

import { api } from "@/trpc/server";

import { DeleteFolderButton } from "./_components/delete-folder-button";
import { EditFolderButton } from "./_components/edit-folder-button";
import { FolderLinks } from "./_components/folder-links";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Folder" };

type FolderDetailPageProps = {
  params: Promise<{ folderId: string }>;
};

export default async function FolderDetailPage({ params }: FolderDetailPageProps) {
  const { folderId } = await params;
  const id = Number.parseInt(folderId);

  if (Number.isNaN(id)) {
    notFound();
  }

  const folder = await api.folder.get.query({ id }).catch(() => notFound());

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-[13px]">
        <Link
          href="/dashboard"
          className="text-neutral-400 transition-colors hover:text-neutral-900 dark:text-muted-foreground dark:hover:text-foreground"
        >
          Dashboard
        </Link>
        <IconChevronRight
          size={14}
          stroke={1.5}
          className="text-neutral-300 dark:text-neutral-600"
        />
        <Link
          href="/dashboard/folders"
          className="text-neutral-400 transition-colors hover:text-neutral-900 dark:text-muted-foreground dark:hover:text-foreground"
        >
          Folders
        </Link>
        <IconChevronRight
          size={14}
          stroke={1.5}
          className="text-neutral-300 dark:text-neutral-600"
        />
        <span className="min-w-0 truncate font-medium text-neutral-900 dark:text-foreground">
          {folder.name}
        </span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            {folder.name}
          </h2>
          {folder.description ? (
            <p className="mt-1 text-[13px] text-neutral-400 dark:text-muted-foreground">
              {folder.description}
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-neutral-400 dark:text-muted-foreground">
              {folder.links.length} {folder.links.length === 1 ? "link" : "links"}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <EditFolderButton folder={folder} />
          <DeleteFolderButton folder={folder} />
        </div>
      </div>

      {/* Links */}
      <FolderLinks links={folder.links} />
    </div>
  );
}
