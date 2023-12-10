import DynamicLinksForm from "@/components/forms/dashboard/links/dynamic-links-project-form";
import prisma from "@/db";

const CreateDynamicLinkProjectPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) => {
  if (searchParams.id) {
    const project = await prisma.dynamicLink.findUnique({
      where: { id: Number(searchParams.id) },
    });

    if (project) {
      return <DynamicLinksForm initialValues={project} />;
    }
  }
  return <DynamicLinksForm />;
};

export default CreateDynamicLinkProjectPage;
