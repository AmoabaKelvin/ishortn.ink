import Link from "next/link";
import LogoutButton from "./custom-signout";

const NavigationBar = () => {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold leading-tight text-gray-800">
        <Link href="/" className="text-blue-600">
          ishortn.ink
        </Link>{" "}
        / Dashboard
      </h2>
      {/* <UserButton afterSignOutUrl="/" /> */}
      <LogoutButton />
    </div>
  );
};

export default NavigationBar;
