"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Prisma } from "@prisma/client";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { deleteDynamicLinkProject } from "@/actions/dynamic-links-actions";

type Link = Prisma.DynamicLinkGetPayload<{}>;

const DynamicLinkProjectCard = ({ link }: { link: Link }) => {
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [loading, startTransition] = useTransition();
  const { toast } = useToast();

  const handleProjectDeletion = async () => {
    startTransition(async () => {
      const response = await deleteDynamicLinkProject(link.id);
      if (response && "id" in response) {
        setOpenDeleteModal(false);
        toast({
          title: "Project deleted",
          description: "Your project has been deleted.",
        });
      } else {
        toast({
          title: "Something went wrong",
          description: "Your project could not be deleted.",
          variant: "destructive",
        });
      }
    });

    return;
  };

  return (
    <>
      <div className="flex flex-col p-3 bg-white rounded-md group">
        <div className="flex items-center justify-between">
          <Link
            href={`/dashboard/links/dynamic/project/create?id=${link.id}`}
            className="hover:underline"
          >
            {link.name}
          </Link>
          <span className="text-sm text-gray-500">
            {link.createdAt.toDateString()}
          </span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-sm text-blue-500">
            <span className="flex items-center" rel="noreferrer">
              {link.subdomain}.ishortn.ink
              {/* <ExternalLinkIcon className="w-3 h-3 ml-0.5" /> */}
            </span>
          </span>
          <Trash2
            className="w-4 h-4 ml-1 text-gray-500 cursor-pointer group-hover:text-red-500"
            onClick={() => setOpenDeleteModal(!openDeleteModal)}
          />
        </div>
      </div>

      <Dialog open={openDeleteModal} onOpenChange={setOpenDeleteModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Project {link.name}</DialogTitle>
            <DialogDescription>
              Deleting this project will delete all of its links. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button type="button" onClick={() => setOpenDeleteModal(false)}>
              Oh no, cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleProjectDeletion}
            >
              Yep, delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DynamicLinkProjectCard;
