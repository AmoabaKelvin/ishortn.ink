"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { IconMenu2, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";

import { Wordmark } from "@/app/(landing)/_components/site-primitives";
import { DOCS_BASE_PATH } from "@/lib/docs/navigation";

import { DocsNav } from "./docs-nav";
import { DocsSearch } from "./docs-search";

const iconButtonClass =
  "grid size-10 shrink-0 place-items-center rounded-lg text-neutral-900 hover:bg-neutral-950/5 dark:text-white dark:hover:bg-white/10";

function Brand() {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <Link href="/" aria-label="Homepage">
        <Wordmark className="text-xl dark:text-white" />
      </Link>
      <span aria-hidden="true" className="h-5 w-px bg-neutral-950/10 dark:bg-white/15" />
      <Link
        href={DOCS_BASE_PATH}
        className="font-title text-base font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        Docs
      </Link>
    </div>
  );
}

export function DocsHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-950/[0.07] bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-neutral-950/90">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Brand />

        <div className="flex flex-1 items-center justify-end gap-2 md:justify-center">
          <DocsSearch />
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/docs/api"
            className="hidden rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-950/5 hover:text-neutral-900 lg:block dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            API reference
          </Link>
          <Link
            href="/dashboard"
            className="hidden whitespace-nowrap rounded-[10px] bg-neutral-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-neutral-800 sm:block dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Dashboard
          </Link>

          <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogPrimitive.Trigger
              className={`${iconButtonClass} lg:hidden`}
              aria-label="Open menu"
            >
              <IconMenu2 aria-hidden="true" className="size-6" />
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Content className="docs-root fixed inset-0 z-50 flex flex-col bg-white lg:hidden dark:bg-neutral-950">
                <DialogPrimitive.Title className="sr-only">
                  Documentation menu
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  Pages in the iShortn documentation.
                </DialogPrimitive.Description>
                <div className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-950/[0.07] px-4 sm:px-6 dark:border-white/10">
                  <Brand />
                  <DialogPrimitive.Close className={iconButtonClass} aria-label="Close menu">
                    <IconX aria-hidden="true" className="size-6" />
                  </DialogPrimitive.Close>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-6 sm:px-4">
                  <DocsNav onNavigate={() => setMenuOpen(false)} />
                  <div className="mt-8 border-t border-neutral-950/[0.07] px-2.5 pt-6 dark:border-white/10">
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center justify-center rounded-[10px] bg-neutral-900 px-4 py-2.5 text-base font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                    >
                      Open dashboard
                    </Link>
                  </div>
                </div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </div>
      </div>
    </header>
  );
}
