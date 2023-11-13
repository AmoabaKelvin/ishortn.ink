import LinkShowcase from "@/components/dashboard/link-showcase";
import TabSwitcher from "@/components/dashboard/tab-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Dashboard = () => {
  return (
    <main className="flex flex-col gap-10">
      <TabSwitcher />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-gray-800">
          Links
        </h2>
        <Button>
          Create Link
          <kbd className="ml-2">⌘K</kbd>
        </Button>
      </div>

      {/* Another section, there will be a column to the right that contains a simple form to create short link quick */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-11">
        <div className="flex flex-col col-span-4 gap-4">
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
                <span className="text-5xl text-gray-500">20</span>
              </div>
              <div className="flex items-center justify-between mt-6">
                <span className="text-xl font-semibold text-gray-800">
                  Total Clicks
                </span>
                <span className="text-5xl text-gray-500">20</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-7">
          <Input type="text" placeholder="Search for a link" />

          <div className="flex flex-col gap-5 mt-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <LinkShowcase key={i} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;
