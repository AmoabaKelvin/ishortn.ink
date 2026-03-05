import { IconBrandDiscord, IconBrandGithub } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

const DashboardHeader = () => {
  return (
    <div className="flex items-center justify-end">
      <div className="flex items-center gap-3">
        <Link
          href="https://docs.google.com/forms/d/e/1FAIpQLSfVfz9c1qkC4aDSjFnMcVnrimKiNOHA2aoQhyxNaMmDjMSNEg/viewform?usp=sf_link"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] text-neutral-500 transition-colors hover:text-neutral-900"
        >
          Feature Requests
        </Link>
        <Link
          href="https://discord.gg/S66ZvMzkU4"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-400 transition-colors hover:text-neutral-900"
        >
          <IconBrandDiscord size={18} stroke={1.5} />
        </Link>
        <Link
          href="https://github.com/AmoabaKelvin/ishortn.ink"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-400 transition-colors hover:text-neutral-900"
        >
          <IconBrandGithub size={18} stroke={1.5} />
        </Link>
      </div>
    </div>
  );
};

export { DashboardHeader as DashboardNav };
