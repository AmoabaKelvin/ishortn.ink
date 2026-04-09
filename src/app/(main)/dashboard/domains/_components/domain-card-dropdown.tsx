"use client";

import { IconDots, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/trpc/react";

interface DomainCardDropdownProps {
  domainId: number;
}

export function DomainCardDropdown({ domainId }: DomainCardDropdownProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const deleteDomainMutation = api.customDomain.delete.useMutation({
    onSuccess: async () => {
      toast.success("Domain and associated links deleted successfully");
      await revalidateRoute("/dashboard/domains");
    },
    onError: (error) => {
      toast.error(`Failed to delete domain: ${error.message}`);
    },
  });

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    toast.promise(deleteDomainMutation.mutateAsync({ id: domainId }), {
      loading: "Deleting domain...",
      success: "Domain deleted successfully",
      error: "Failed to delete domain",
    });
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600"
          >
            <IconDots size={14} stroke={1.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={handleDeleteClick}
              className="text-red-600 dark:text-red-400"
            >
              <IconTrash size={14} stroke={1.5} className="mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px]">
              Delete domain
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              This will permanently delete the domain and all associated links.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-[13px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="h-9 bg-red-600 text-[13px] hover:bg-red-700"
            >
              {deleteDomainMutation.isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
