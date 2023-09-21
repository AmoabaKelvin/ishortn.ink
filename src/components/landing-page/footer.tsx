import { Button } from "@/components/ui/button";
import Link from "next/link";

const PageFooter = () => {
  return (
    <footer className="flex flex-col justify-center items-center py-1 h-full bg-gray-900 text-white">
      We love Open Source
      <Button variant="link" className="text-white">
        <Link
          href="https://github.com/AmoabaKelvin/ishortn.ink"
          target="_blank"
        >
          Github
        </Link>
      </Button>
    </footer>
  );
};

export default PageFooter;
