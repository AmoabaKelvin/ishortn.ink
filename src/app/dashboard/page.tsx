import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from "@clerk/nextjs";

import LinksView from "@/components/dashboard/link-overview/links-view";
import prisma from "@/db";
import Link from "next/link";

// Get all links from the user
const getUserLinks = async () => {
  const { userId } = auth();
  console.log(userId);
  const links = await prisma.link.findMany({
    where: {
      userId: userId,
    },
    include: {
      linkVisits: true,
    },
  });

  return links;
};

const Dashboard = async () => {
  const links = await getUserLinks();
  return (
    <main className="flex flex-col gap-10">
      {/* <TabSwitcher /> */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-gray-800">
          Links
        </h2>
        <Button asChild>
          <Link href="/dashboard/links">
            Create Link
            <kbd className="ml-2">⌘K</kbd>
          </Link>
        </Button>
      </div>

      {/* Another section, there will be a column to the right that contains a simple form to create short link quick */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-11">
        <div className="flex flex-col w-full col-span-11 gap-4 md:col-span-4 ">
          <div className="p-6 rounded-md bg-gray-50 h-max">
            <div>
              <h1 className="text-xl font-semibold leading-tight text-gray-800">
                Quick Shorten
              </h1>
              <p className="text-sm text-gray-500">
                Shorten a link quickly without any settings
              </p>
            </div>
            <div>
              <Label htmlFor="url">URL</Label>
              <Input id="url" type="text" placeholder="https://example.com" />
            </div>
            <Button className="w-full mt-5">Shorten</Button>
          </div>

          {/* Quick Stats, total links, total clicks */}
          <div className="flex flex-col gap-4 p-6 rounded-md bg-gray-50 h-max">
            <div>
              <h1 className="text-xl font-semibold leading-tight text-gray-800">
                Quick Stats
              </h1>
              <p className="text-sm text-gray-500">
                Get a quick overview of your links
              </p>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2 rounded-md">
                <span className="text-xl font-semibold text-gray-800">
                  Total Links
                </span>
                <span className="text-5xl text-gray-500">{links.length}</span>
              </div>
              <div className="flex items-center justify-between mt-6">
                <span className="text-xl font-semibold text-gray-800">
                  Total Clicks
                </span>
                <span className="text-5xl text-gray-500">
                  {links.reduce((acc, link) => acc + link.linkVisits.length, 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-11 md:col-span-7">
          <LinksView links={links} />
        </div>
      </div>
    </main>
  );
};

export default Dashboard;
