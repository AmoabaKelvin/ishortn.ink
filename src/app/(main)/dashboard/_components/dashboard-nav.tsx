import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

const DashboardNav = () => {
  return (
    <div className="flex items-center justify-between">
      <h2 className="inline-flex text-xl font-semibold leading-tight text-gray-800">
        <Link href="/" className="text-blue-600 dark:text-blue-500">
          ishortn.ink
        </Link>{" "}
        <span className="ml-2 hidden sm:block">/ Dashboard</span>
      </h2>
      <div className="flex items-center justify-between space-x-4">
        <div className="flex items-center gap-4">
          <Link
            href="https://docs.google.com/forms/d/e/1FAIpQLSfVfz9c1qkC4aDSjFnMcVnrimKiNOHA2aoQhyxNaMmDjMSNEg/viewform?usp=sf_link"
            className="text-sm"
          >
            Feature Requests
          </Link>
          <Link href="https://discord.gg/S66ZvMzkU4" target="_blank">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a69f118df70ad7828d4_icon_clyde_blurple_RGB.svg"
              width={20}
              height={20}
              alt="Discord"
            />
          </Link>
          <Link href="https://github.com/AmoabaKelvin/ishortn.ink" target="_blank">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/GitHub_Invertocat_Logo.svg/600px-GitHub_Invertocat_Logo.svg.png"
              width={20}
              height={20}
              alt="GitHub"
            />
          </Link>
        </div>
        <UserButton />
      </div>
      {/* <LogoutButton /> */}
    </div>
  );
};

export { DashboardNav };
