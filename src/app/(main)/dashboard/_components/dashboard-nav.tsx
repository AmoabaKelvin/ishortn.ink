import { DiscordLogoIcon, GitHub } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

const DashboardNav = () => {
  return (
    <div className="flex items-center justify-between">
      <h2 className="inline-flex text-xl font-semibold leading-tight">
        <Link href="/" className="text-blue-600 dark:text-blue-500">
          ishortn.ink
        </Link>{" "}
        <span className="ml-2 hidden text-foreground sm:block">/ Dashboard</span>
      </h2>
      <div className="flex items-center justify-between space-x-4">
        <div className="flex items-center gap-4">
          <Link
            href="https://docs.google.com/forms/d/e/1FAIpQLSfVfz9c1qkC4aDSjFnMcVnrimKiNOHA2aoQhyxNaMmDjMSNEg/viewform?usp=sf_link"
            className="text-sm text-foreground"
          >
            Feature Requests
          </Link>
          <Link href="https://discord.gg/S66ZvMzkU4" target="_blank">
            <DiscordLogoIcon className="size-5 text-foreground" />
          </Link>
          <Link href="https://github.com/AmoabaKelvin/ishortn.ink" target="_blank">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <GitHub className="size-5 text-foreground" />
          </Link>
          <ThemeToggle />
        </div>
        <UserButton />
      </div>
      {/* <LogoutButton /> */}
    </div>
  );
};

export { DashboardNav };
