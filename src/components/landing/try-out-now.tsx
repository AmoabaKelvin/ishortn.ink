"use client";

import * as React from "react";

import { CommandDialog } from "@/components/ui/command";
import { Button } from "../ui/button";
import { LinkShortenerAndQRGenerator } from "../forms/link-shortener-and-qr-generator";
import Link from "next/link";

export function TryOutNow() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <Button
        asChild
        className="button_black button_text flex flex-row gap-2"
        variant="default"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Link href="/">
          Try now{" "}
          <span className="hidden lg:block m-auto text-xs bg-gradient-to-r from-slate-400 to-slate-100 bg-clip-text text-transparent">
            ⌘S
          </span>
        </Link>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <LinkShortenerAndQRGenerator />
      </CommandDialog>
    </>
  );
}
