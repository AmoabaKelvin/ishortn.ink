"use client";

import { useUser } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import Link from "next/link";

export const Navbar = () => {
  const { isSignedIn } = useUser();

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <nav className="fixed w-full z-50 bg-[#050505]/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-1 cursor-pointer group">
            <div className="bg-white text-black p-1 font-black text-lg tracking-tighter group-hover:bg-[#FF3300] transition-colors">
              iShortn
            </div>
            <span className="font-bold text-xl tracking-tight text-white group-hover:tracking-widest transition-all duration-300">
              .ink
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-sm font-medium">
            {["Features", "Pricing"].map((item) => (
              <Link
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={(e) => handleScroll(e, `#${item.toLowerCase()}`)}
                className="text-neutral-400 hover:text-[#FF3300] transition-colors uppercase tracking-wider text-xs font-bold"
              >
                {item}
              </Link>
            ))}
            <Link href="/auth/sign-in" className="text-neutral-400 hover:text-[#FF3300] transition-colors uppercase tracking-wider text-xs font-bold">
              Login
            </Link>
            {isSignedIn ? (
              <Link href="/dashboard">
                <button className="bg-white hover:bg-[#FF3300] text-black px-5 py-2 text-xs font-black uppercase tracking-widest transition-all border border-transparent hover:border-[#FF3300]">
                  Dashboard
                </button>
              </Link>
            ) : (
              <Link href="/auth/sign-up">
                <button className="bg-white hover:bg-[#FF3300] text-black px-5 py-2 text-xs font-black uppercase tracking-widest transition-all border border-transparent hover:border-[#FF3300]">
                  Get_Started
                </button>
              </Link>
            )}
          </div>

          <div className="md:hidden text-white">
            <Menu />
          </div>
        </div>
      </div>
    </nav>
  );
};
