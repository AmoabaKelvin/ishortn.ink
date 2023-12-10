import DynamicLinksForm from "@/components/forms/dashboard/links/dynamic-link-child-form";
import prisma from "@/db";
import { auth } from "@clerk/nextjs";

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
