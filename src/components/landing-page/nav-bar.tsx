import Image from "next/image";
import Link from "next/link";

import Logo from "../../../public/images/logo-text-white.png";

const navigation = [
  { name: "All features", href: "#features" },
  { name: "About us", href: "#footer" },
];

export default function LandingPageNav() {
  const handleScrollingToElementHref = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="overflow-hidden bg-transparent">
      <nav
        className="w-11/12 px-4 mx-auto md:w-4/5 sm:px-6 lg:px-5"
        aria-label="Top"
      >
        <div className="flex items-center justify-between py-2 mx-auto border-b border-yellow-500 lg:border-none">
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
                onClick={(e) => {
                  e.preventDefault();
                  handleScrollingToElementHref(link.href);
                }}
                className="text-base text-white font-mazzardRegular hover:text-yellow-500"
              >
                {link.name}
              </a>
            ))}
          </div>
          <div className="ml-10 space-x-4">
            <Link
              href="/auth/sign-in"
              className="inline-block px-1 py-1 text-sm font-medium text-white bg-green-500 border border-transparent rounded-md md:py-2 md:px-4 md:text-base hover:bg-opacity-75"
            >
              Sign in
            </Link>
            <Link
              href="/auth/sign-up"
              className="inline-block px-1 py-1 text-sm font-medium text-black bg-yellow-500 border border-transparent rounded-md md:py-2 md:px-4 md:text-base hover:bg-yellow-600"
            >
              Sign up
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap justify-center py-4 space-x-4 lg:hidden">
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
