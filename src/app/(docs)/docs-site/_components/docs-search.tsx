"use client";

import { IconFileText, IconHash, IconSearch } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DOCS_PAGES, docsHref } from "@/lib/docs/navigation";
import { searchDocs, searchExcerpt } from "@/lib/docs/utils";
import { cn } from "@/lib/utils";

import type { DocsSearchRecord } from "@/lib/docs/utils";

// Fetched once per session, the first time search opens.
let indexRequest: Promise<DocsSearchRecord[]> | null = null;

function loadIndex(): Promise<DocsSearchRecord[]> {
  indexRequest ??= fetch("/docs/search-index.json").then((response) => {
    if (!response.ok) throw new Error(`Search index request failed: ${response.status}`);
    // SAFETY: the route serves getDocsSearchIndex() output verbatim.
    return response.json() as Promise<DocsSearchRecord[]>;
  });
  indexRequest.catch(() => {
    indexRequest = null;
  });
  return indexRequest;
}

const subscribeToNothing = () => () => {};

type IndexState =
  | { status: "loading" }
  | { status: "ready"; records: DocsSearchRecord[] }
  | { status: "error" };

export function DocsSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<IndexState>({ status: "loading" });
  const shortcut = useSyncExternalStore(
    subscribeToNothing,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "Ctrl K",
  );

  const openSearch = () => {
    setOpen(true);
    setIndex((current) => (current.status === "ready" ? current : { status: "loading" }));
    loadIndex()
      .then((records) => setIndex({ status: "ready", records }))
      .catch(() => setIndex({ status: "error" }));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (
        (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" && !typing)
      ) {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo(
    () => (index.status === "ready" ? searchDocs(index.records, query) : []),
    [index, query],
  );

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        className={cn(
          // Icon button on phones, a search field from md up.
          "grid size-10 shrink-0 place-items-center rounded-lg text-neutral-900 hover:bg-neutral-950/5 dark:text-white dark:hover:bg-white/10",
          "md:flex md:h-auto md:w-full md:max-w-sm md:items-center md:gap-2 md:rounded-[10px] md:bg-neutral-950/[0.04] md:px-3 md:py-2 md:text-left md:text-sm md:text-neutral-500 md:ring-1 md:ring-inset md:ring-neutral-950/[0.07] md:hover:bg-neutral-950/[0.06] md:dark:bg-white/5 md:dark:text-neutral-400 md:dark:ring-white/10",
          className,
        )}
      >
        <IconSearch aria-hidden="true" className="size-5 shrink-0 md:size-4" />
        <span className="sr-only md:not-sr-only md:flex-1 md:truncate">Search docs</span>
        <kbd
          aria-hidden="true"
          className="hidden rounded-md bg-white px-1.5 font-sans text-xs text-neutral-500 ring-1 ring-neutral-950/10 md:inline dark:bg-white/10 dark:text-neutral-400 dark:ring-white/10"
        >
          {shortcut}
        </kbd>
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <DialogContent className="top-4 max-w-[calc(100%-2rem)] translate-y-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-top-0 sm:top-[12vh] sm:max-w-xl">
          <DialogTitle className="sr-only">Search documentation</DialogTitle>
          <DialogDescription className="sr-only">
            Type to search guides and the API reference.
          </DialogDescription>
          <Command shouldFilter={false} label="Search documentation">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search guides and API reference"
              className="pr-8 text-base sm:text-sm"
            />
            <CommandList className="max-h-[min(60vh,420px)]">
              {index.status === "error" ? (
                <p className="px-4 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  Search couldn&apos;t load. Check your connection and reopen it.
                </p>
              ) : index.status !== "ready" && query ? (
                <div className="space-y-2 p-3" aria-label="Loading results">
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-10 w-2/3 rounded-lg" />
                </div>
              ) : query ? (
                <>
                  <CommandEmpty>No results for &ldquo;{query}&rdquo;</CommandEmpty>
                  <CommandGroup>
                    {results.map((record) => (
                      <CommandItem
                        key={record.href}
                        value={record.href}
                        onSelect={() => go(record.href)}
                        className="items-start gap-3 py-2.5"
                      >
                        {record.heading ? (
                          <IconHash
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-neutral-400"
                          />
                        ) : (
                          <IconFileText
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-neutral-400"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate">
                            {record.heading ?? record.page}
                            {record.heading ? (
                              <span className="font-normal text-neutral-500 dark:text-neutral-400">
                                {" "}
                                · {record.page}
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-sm font-normal text-neutral-500 dark:text-neutral-400">
                            {searchExcerpt(record.text, query)}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              ) : (
                <CommandGroup heading="Pages">
                  {DOCS_PAGES.map((page) => (
                    <CommandItem
                      key={page.slug}
                      value={docsHref(page.slug)}
                      onSelect={() => go(docsHref(page.slug))}
                      className="gap-3"
                    >
                      <IconFileText
                        aria-hidden="true"
                        className="size-4 shrink-0 text-neutral-400"
                      />
                      <span className="truncate">{page.title}</span>
                      <span className="ml-auto shrink-0 text-sm font-normal text-neutral-400 dark:text-muted-foreground">
                        {page.section}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
