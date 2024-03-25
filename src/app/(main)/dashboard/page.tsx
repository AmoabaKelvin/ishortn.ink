import { auth } from "@clerk/nextjs";
import Link from "next/link";

import LinksView from "@/components/dashboard/link-overview/links-view";
import QuickShortenForm from "@/components/forms/dashboard/links/quick-shorten";
import { Button } from "@/components/ui/button";
import prisma from "@/db";

const getUserLinks = async () => {
  const { userId } = auth();
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
            Create Link{" "}
            <kbd className="px-1.5 py-0.5 ml-2 bg-gray-600 rounded-sm shadow-lg hidden md:inline">
              ⌘<span className="ml-1">K</span>
            </kbd>
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
              <QuickShortenForm />
            </div>
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

          {/* buy me a coffee button */}
          <a href="https://www.buymeacoffee.com/kelvinamoaba">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.buymeacoffee.com/button-api/?text=Help keep the servers alive&emoji=&slug=kelvinamoaba&button_colour=5F7FFF&font_colour=ffffff&font_family=Inter&outline_colour=000000&coffee_colour=FFDD00"
              className="w-full h-12"
              alt="Buy Me A Coffee"
            />
          </a>
        </div>
        <div className="col-span-11 md:col-span-7">
          <LinksView links={links} />
        </div>
      </div>
    </main>
  );
};

export default Dashboard;
