"use client";

import { HamburgerMenuIcon } from "@radix-ui/react-icons";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_TITLE } from "@/lib/constants";

const routes = [
  { name: "Home", href: "/" },
  { name: "Features", href: "/#features" },
  { name: "FAQ", href: "/#faq" },
  {
    name: "Documentation",
    href: "https://www.touha.dev/posts/simple-nextjs-t3-authentication-with-lucia",
  },
] as const;

const handleSmoothScroll = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
  if (href.startsWith("/#")) {
    event.preventDefault();
    const targetId = href.split("#")[1];
    const targetElement = document.getElementById(targetId!);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" });
    }
  }
};

export const Header = () => {
  return (
    <header className="px-2 py-4 lg:py-6">
      <div className="container flex items-center gap-2 p-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="focus:outline-none focus:ring-1 md:hidden"
              size="icon"
              variant="outline"
            >
              <HamburgerMenuIcon className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <div className="py-1">
              {routes.map(({ name, href }) => (
                <DropdownMenuItem key={name} asChild>
                  <Link href={href} onClick={(e) => handleSmoothScroll(e, href)}>
                    {name}
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <Link className="flex items-center justify-center text-xl font-bold" href="/">
          {APP_TITLE}
        </Link>
        <nav className="ml-10 hidden gap-4 sm:gap-6 md:flex">
          {routes.map(({ name, href }) => (
            <Link
              key={name}
              className="text-sm font-medium text-muted-foreground/70 transition-colors hover:text-muted-foreground"
              href={href}
              onClick={(e) => handleSmoothScroll(e, href)}
            >
              {name}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <Button asChild variant={"secondary"}>
            <Link href="/sign-in">Login</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};
