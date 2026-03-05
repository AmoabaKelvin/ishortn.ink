import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { notFound } from "next/navigation";

import { api } from "@/trpc/server";

import { DeleteFolderButton } from "./_components/delete-folder-button";
import { EditFolderButton } from "./_components/edit-folder-button";
import { FolderLinks } from "./_components/folder-links";

type FolderDetailPageProps = {
  params: Promise<{ folderId: string }>;
};

export default async function FolderDetailPage({
  params,
}: FolderDetailPageProps) {
  const { folderId } = await params;
  const id = Number.parseInt(folderId);

  if (Number.isNaN(id)) {
    notFound();
  }

  try {
    const folder = await api.folder.get.query({ id });

    return (
      <div>
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-[13px]">
          <Link
            href="/dashboard"
            className="text-neutral-400 transition-colors hover:text-neutral-900"
          >
            Dashboard
          </Link>
          <IconChevronRight size={14} stroke={1.5} className="text-neutral-300" />
          <Link
            href="/dashboard/folders"
            className="text-neutral-400 transition-colors hover:text-neutral-900"
          >
            Folders
          </Link>
          <IconChevronRight size={14} stroke={1.5} className="text-neutral-300" />
          <span className="font-medium text-neutral-900">{folder.name}</span>
        </nav>

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
              {folder.name}
            </h2>
            {folder.description ? (
              <p className="mt-1 text-[13px] text-neutral-400">
                {folder.description}
              </p>
            ) : (
              <p className="mt-1 text-[13px] text-neutral-400">
                {folder.links.length}{" "}
                {folder.links.length === 1 ? "link" : "links"}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <EditFolderButton folder={folder} />
            <DeleteFolderButton folder={folder} />
          </div>
        </div>

        {/* Links */}
        <FolderLinks links={folder.links} folderId={folder.id} />
      </div>
    );
  } catch {
    notFound();
  }
}
