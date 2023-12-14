import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

const NavigationBar = () => {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold leading-tight text-gray-800">
        <Link href="/" className="text-blue-600">
          ishortn.ink
        </Link>{" "}
        / Dashboard
      </h2>
      <div className="flex items-center justify-between space-x-4">
        <div className="flex items-center gap-4">
          <Link href="https://discord.gg/DE9xjVvk" target="_blank">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a69f118df70ad7828d4_icon_clyde_blurple_RGB.svg"
              width={20}
              height={20}
              alt="Discord"
            />
          </Link>
          <Link href="https://ishortn.ink/feedback" target="_blank">
            <span className="text-sm font-medium text-gray-600 hover:text-gray-800">
              Feedback
            </span>
          </Link>
        </div>
        <UserButton />
      </div>
      {/* <LogoutButton /> */}
    </div>
  );
};

export default NavigationBar;
