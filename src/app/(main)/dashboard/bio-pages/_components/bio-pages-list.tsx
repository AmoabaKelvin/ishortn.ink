"use client";

import { IconExternalLink, IconLayoutList, IconPlus, IconTrash } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Plan } from "@/lib/billing/plans";
import { api } from "@/trpc/react";
import type { RouterOutputs } from "@/trpc/shared";

import { CreateBioPageDialog } from "./create-bio-page-dialog";

type BioPagesListProps = {
  pages: RouterOutputs["bioPage"]["list"];
  plan: Plan;
  bioPageLimit: number | null;
};

export function BioPagesList({ pages, bioPageLimit }: BioPagesListProps) {
  const router = useRouter();
  const atLimit = bioPageLimit !== null && pages.length >= bioPageLimit;

  const deletePage = api.bioPage.delete.useMutation({
    onSuccess: () => {
      toast.success("Bio page deleted.");
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Bio Pages
          </h2>
          <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
            One link for everything you share, tracked with your existing analytics.
          </p>
        </div>

        {pages.length > 0 &&
          (atLimit ? (
            <span
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-neutral-100 px-4 py-2 text-[13px] font-medium text-neutral-400 dark:bg-muted dark:text-neutral-500"
              title="You've reached your plan's bio page limit."
            >
              <IconPlus size={16} stroke={2} />
              New page
            </span>
          ) : (
            <CreateBioPageDialog
              trigger={
                <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform] hover:bg-blue-700 active:scale-[0.97]">
                  <IconPlus size={16} stroke={2} />
                  New page
                </button>
              }
            />
          ))}
      </div>

      {pages.length === 0 ? (
        <EmptyState canCreate={!atLimit} />
      ) : (
        <div className="divide-y divide-neutral-200/70 dark:divide-border">
          {pages.map((page, index) => (
            <motion.div
              key={page.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: Math.min(index, 6) * 0.05,
                type: "spring",
                duration: 0.4,
                bounce: 0,
              }}
              className="flex items-center justify-between gap-4 py-4"
            >
              <Link
                href={`/dashboard/bio-pages/${page.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-muted">
                  <IconLayoutList size={18} stroke={1.5} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-neutral-900 dark:text-foreground">
                      {page.title || `/${page.slug}`}
                    </span>
                    {page.isPublished ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        Live
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-neutral-400 dark:text-neutral-500">
                    ishortn.ink/p/{page.slug} · {page.blockCount}{" "}
                    {page.blockCount === 1 ? "block" : "blocks"}
                  </span>
                </span>
              </Link>

              <div className="flex shrink-0 items-center gap-1">
                {page.isPublished && (
                  <a
                    href={`/p/${page.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-muted"
                    title="View live page"
                  >
                    <IconExternalLink size={16} stroke={1.5} />
                  </a>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Delete page"
                    >
                      <IconTrash size={16} stroke={1.5} />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this bio page?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the page, its blocks, and the analytics for its
                        links. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => deletePage.mutate({ id: page.id })}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16 text-center dark:border-border">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-muted">
        <IconLayoutList size={22} stroke={1.5} />
      </span>
      <h3 className="mt-4 text-[15px] font-medium text-neutral-900 dark:text-foreground">
        Create your first bio page
      </h3>
      <p className="mt-1 max-w-sm text-[13px] text-neutral-400 dark:text-neutral-500">
        A single shareable page for all your links. Every click is tracked through your existing
        analytics.
      </p>
      {canCreate && (
        <div className="mt-5">
          <CreateBioPageDialog
            trigger={
              <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform] hover:bg-blue-700 active:scale-[0.97]">
                <IconPlus size={16} stroke={2} />
                New page
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
