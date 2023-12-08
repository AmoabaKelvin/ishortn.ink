import DynamicLinksForm from "@/components/forms/dashboard/links/dynamic-link-child-form";
import prisma from "@/db";
import { auth } from "@clerk/nextjs";

const DynamicLinkCreatePage = async () => {
  const { userId } = auth();

  const dynamicLinksProjects = await prisma.dynamicLink.findMany({
    where: {
      userId: userId as string,
    },
  });

  return <DynamicLinksForm userDynamicLinksProjects={dynamicLinksProjects} />;
};

export default DynamicLinkCreatePage;
