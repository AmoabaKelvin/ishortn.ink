import type { RouterOutputs } from "@/trpc/shared";

type ListedLink = RouterOutputs["link"]["list"]["links"][number];

// Folder pages render the same card from `folder.get`, which carries no creator info.
export type LinkCardLink = Omit<ListedLink, "createdBy"> & Partial<Pick<ListedLink, "createdBy">>;
