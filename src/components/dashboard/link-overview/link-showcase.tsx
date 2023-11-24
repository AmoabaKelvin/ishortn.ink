"use client";

import { LinkActions } from "@/components/dashboard/link-overview/link-actions";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

import { Prisma } from "@prisma/client";

import { deleteLink } from "@/app/dashboard/_actions/link-actions";

type Link = Prisma.LinkGetPayload<{
  include: {
    linkVisits: true;
  };
}>;

const LinkShowcase = ({ link }: { link: Link }) => {
  const { toast } = useToast();
  const router = useRouter();

  const daysSinceToday = Math.floor(
    (new Date().getTime() - new Date(link.createdAt).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const handleLinkDeletion = async () => {
    const response = await deleteLink(link.id);
    console.log(response);
    if (response && "id" in response) {
      toast({
        title: "Link deleted",
        description: "Your link has been deleted.",
      });
    } else {
      toast({
        title: "Error",
        description: "An error occurred while deleting your link.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 rounded-md bg-slate-50">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <p
            className="flex items-center text-blue-600 cursor-pointer hover:underline"
            onClick={() => router.push(`/dashboard/analytics/${link.alias}`)}
          >
            <span className="inline-block w-2 h-2 mr-2 bg-blue-300 rounded-full animate-pulse"></span>
            ishortn.ink/{link.alias}
          </p>
          <div className="flex items-center justify-center w-6 h-6 bg-white rounded-full cursor-pointer hover:animate-wiggle-more ">
            <Copy
              className="w-3 h-3"
              onClick={() => {
                window.navigator.clipboard.writeText(
                  `ishortn.ink/${link.alias}`,
                );
                toast({
                  description: "The link has been copied to your clipboard",
                });
              }}
            />
          </div>
        </div>
        <p className="text-sm text-gray-500">
          <span>
            {/* Only show the days since today */}
            {daysSinceToday === 0 ? "Today" : `${daysSinceToday}d`}
          </span>
          <span className="mx-1 text-slate-300">•</span>
          <span className="text-gray-900 cursor-pointer hover:underline">
            {link.url}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="transition-all duration-500 rounded-md bg-slate-100 hover:scale-110"
        >
          {link.linkVisits.length}
          <span className="hidden md:inline">visits</span>
          <span className="inline md:hidden">v</span>
        </Badge>

        <LinkActions handleDelete={handleLinkDeletion} />
      </div>
    </div>
  );
};

export default LinkShowcase;
