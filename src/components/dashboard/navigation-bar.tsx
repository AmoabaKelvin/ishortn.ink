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
        <Link href="https://ishortn.ink/feedback" target="_blank">
          <span className="text-sm font-medium text-gray-600 hover:text-gray-800">
            Feedback
          </span>
        </Link>
        <UserButton />
      </div>
      {/* <LogoutButton /> */}
    </div>
  );
};

export default NavigationBar;
