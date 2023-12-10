import DynamicLinksForm from "@/components/forms/dashboard/links/dynamic-link-child-form";
import prisma from "@/db";
import { auth } from "@clerk/nextjs";
import Link from "next/link";

const DynamicLinkCreatePage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) => {
  const { userId } = auth();

  const dynamicLinksProjects = await prisma.dynamicLink.findMany({
    where: {
      userId: userId as string,
    },
  });

  // if there are no projects then we have to return an empty state that
  // prompts the user to create a project first
  if (dynamicLinksProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <h1 className="text-3xl font-bold text-gray-800">No projects found</h1>
        <p className="mt-2 text-gray-500">
          You need to create a project first before you can create a dynamic
          link.
        </p>
        <Link href="/dashboard/links/dynamic/project/create">
          <span className="mt-4 text-blue-500 hover:underline">
            Create a project
          </span>
        </Link>
      </div>
    );
  }

  if (searchParams.id) {
    const dynamicLinkChild = await prisma.dynamicLinkChildLink.findFirst({
      where: {
        id: Number(searchParams.id),
      },
    });

    if (dynamicLinkChild) {
      return (
        <DynamicLinksForm
          userDynamicLinksProjects={dynamicLinksProjects}
          formFields={dynamicLinkChild}
          selectedLinkID={dynamicLinkChild.id}
          selectedProject={dynamicLinkChild.dynamicLinkId}
        />
      );
    }
  }

  return <DynamicLinksForm userDynamicLinksProjects={dynamicLinksProjects} />;
};

export default DynamicLinkCreatePage;
