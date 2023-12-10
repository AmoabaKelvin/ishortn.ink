import { Prisma } from "@prisma/client";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

type Link = Prisma.DynamicLinkGetPayload<{}>;

const DynamicLinkProjectCard = ({ link }: { link: Link }) => {
  return (
    <div className="flex flex-col p-3 bg-white rounded-md">
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
      <span className="">
        <span className="text-sm text-blue-500">
          <Link
            href={`https://${link.subdomain}.ishortn.ink`}
            target="_blank"
            className="flex items-center"
            rel="noreferrer"
          >
            {link.subdomain}.ishortn.ink
            <ExternalLinkIcon className="w-3 h-3 ml-0.5" />
          </Link>
        </span>
      </span>
    </div>
  );
};

export default DynamicLinkProjectCard;
