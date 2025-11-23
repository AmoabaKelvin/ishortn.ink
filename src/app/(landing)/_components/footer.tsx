import Link from "next/link";

export const Footer = () => {
  return (
    <footer className="border-t border-white/10 bg-[#050505] py-12">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
        <div className="flex items-center gap-2 mb-4 md:mb-0">
          <div className="w-4 h-4 bg-white" />
          <span className="font-mono text-sm text-neutral-400">
            © 2025 iShortn.ink
          </span>
        </div>
        <div className="flex gap-8 font-mono text-xs text-neutral-500">
          <Link href="#" className="hover:text-white transition-colors">
            TERMS
          </Link>
          <Link href="#" className="hover:text-white transition-colors">
            PRIVACY
          </Link>
          <Link href="#" className="hover:text-white transition-colors">
            HELP
          </Link>
        </div>
      </div>
    </footer>
  );
};
