import { api } from "@/trpc/server";

import { FoldersView } from "./_components/folders-view";

export const dynamic = "force-dynamic";

export default async function FoldersPage() {
  const [folders, subDetails] = await Promise.all([
    api.folder.list.query(),
    api.subscriptions.get.query(),
  ]);

  const isProUser = subDetails?.subscriptions?.status === "active";

  return <FoldersView initialFolders={folders} isProUser={isProUser} />;
}
