import { Link } from "next-view-transitions";

const DashboardHeader = () => {
  return (
    <div className="flex items-center justify-end">
      <div className="flex items-center gap-4">
        <Link
          href="https://docs.google.com/forms/d/e/1FAIpQLSfVfz9c1qkC4aDSjFnMcVnrimKiNOHA2aoQhyxNaMmDjMSNEg/viewform?usp=sf_link"
          className="text-sm text-gray-600 hover:text-gray-900"
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
        <Link
          href="https://github.com/AmoabaKelvin/ishortn.ink"
          target="_blank"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/GitHub_Invertocat_Logo.svg/600px-GitHub_Invertocat_Logo.svg.png"
            width={20}
            height={20}
            alt="GitHub"
          />
        </Link>
      </div>
    </div>
  );
};

export { DashboardHeader as DashboardNav };
