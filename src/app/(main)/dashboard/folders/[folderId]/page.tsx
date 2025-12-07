import { ChevronRight, FolderOpen, Home } from "lucide-react";
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
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500">
          <Link
            href="/dashboard"
            className="flex items-center hover:text-gray-900 transition-colors"
          >
            <Home className="h-4 w-4 mr-1" />
            Dashboard
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link
            href="/dashboard/folders"
            className="hover:text-gray-900 transition-colors"
          >
            Folders
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-medium">{folder.name}</span>
        </nav>

        {/* Folder Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <FolderOpen className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                {folder.name}
              </h1>
              {folder.description && (
                <p className="mt-2 text-gray-500">{folder.description}</p>
              )}
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                <span className="font-medium text-gray-700">
                  {folder.links.length}
                </span>
                <span>{folder.links.length === 1 ? "link" : "links"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <EditFolderButton folder={folder} />
            <DeleteFolderButton folder={folder} />
          </div>
        </div>

        {/* Links Section */}
        <div className="mt-8">
          <FolderLinks links={folder.links} folderId={folder.id} />
        </div>
      </div>
    );
  } catch (error) {
    notFound();
  }
}
