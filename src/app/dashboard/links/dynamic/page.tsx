import { Button } from "@/components/ui/button";
import Link from "next/link";

import DynamicLinksView from "@/components/dashboard/dynamic-links/dynamic-links-view";
import DynamicLinkProjectCard from "@/components/dashboard/dynamic-links/project-card";
import prisma from "@/db";
import { auth } from "@clerk/nextjs";

const DynamicLinksDashboard = async () => {
  const { userId } = auth();
  const dynamicLinksProjects = await prisma.dynamicLink.findMany({
    include: {
      childLinks: {
        where: {
          createdFromUI: true,
        },
      },
    },
    where: {
      userId: auth().userId as string,
    },
  });

  return (
    <main className="flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-gray-800">
          Dynamic Links
        </h2>
        <Button asChild>
          <Link href="/dashboard/links/dynamic/create">
            Create Dynamic Link
          </Link>
        </Button>
      </div>

      {/* Another section, there will be a column to the right that contains a simple form to create short link quick */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-11">
        <div className="flex flex-col w-full col-span-11 gap-4 md:col-span-4 ">
          <div className="p-6 rounded-md bg-gray-50 h-max">
            <div>
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold leading-tight text-gray-800">
                  Projects
                </h1>

                <Button asChild variant="outline">
                  <Link href="/dashboard/links/dynamic/project/create">
                    New
                  </Link>
                </Button>
              </div>

              <p className="text-sm text-gray-500">
                Overview of all your dynamic links projects
              </p>
            </div>
            <div>
              {/* check the length, if 0, display a message and a button to create new project */}
              {dynamicLinksProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 mt-10">
                  <div className="text-center">
                    <h1 className="text-2xl font-semibold leading-tight text-gray-800">
                      Uh oh!
                    </h1>
                    <p className="text-sm text-gray-500">
                      You don&apos;t have any projects yet
                    </p>
                  </div>
                  <Button asChild className="w-full">
                    <Link href="/dashboard/links/dynamic/create">
                      Create New Project
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 mt-6">
                  {dynamicLinksProjects.map((project) => (
                    <DynamicLinkProjectCard key={project.id} link={project} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-span-11 md:col-span-7">
          <div className="mt-4">
            <DynamicLinksView links={dynamicLinksProjects} />
          </div>
        </div>
      </div>
    </main>
  );
};

export default DynamicLinksDashboard;
