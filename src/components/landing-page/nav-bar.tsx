import Image from "next/image";
import Logo from "../../../public/images/logo-text-white.png";

const navigation = [
  { name: "How it works?", href: "#" },
  { name: "All features", href: "#" },
  { name: "About us", href: "#" },
  // { name: "Company", href: "#" },
];

export default function LandingPageNav() {
  return (
    <header className="bg-transparent overflow-hidden">
      <nav
        className=" w-11/12 md:w-4/5  mx-auto px-4 sm:px-6 lg:px-5 py-5"
        aria-label="Top"
      >
        <div className=" mx-auto py-2 flex items-center justify-between border-b border-yellow-500 lg:border-none">
          <div className="flex items-center">
            <a href="#">
              <Image src={Logo} alt="logo" width={100} height={100} />
            </a>
          </div>
          <div className="hidden ml-10 space-x-8 lg:block">
            {navigation.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-base font-mazzardRegular text-white hover:text-yellow-500"
              >
                {link.name}
              </a>
            ))}
          </div>
          <div className="ml-10 space-x-4">
            <a
              href="#"
              className="inline-block bg-green-500 text-sm px-1 py-1 md:py-2 md:px-4  border border-transparent rounded-md md:text-base font-medium text-white hover:bg-opacity-75"
            >
              Sign in
            </a>
            <a
              href="#"
              className="inline-block bg-yellow-500 text-sm px-1 py-1 md:py-2 md:px-4 border border-transparent rounded-md md:text-base font-medium text-black hover:bg-yellow-600"
            >
              Sign up
            </a>
          </div>
        </div>
        <div className="py-4 flex flex-wrap justify-center space-x-8 md:space-x-28 lg:hidden">
          {navigation.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-white hover:text-indigo-50"
            >
              {link.name}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
