"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Children, isValidElement, useRef, useSyncExternalStore } from "react";

import { codeSurfaceClass } from "./code-block";
import { CopyButton } from "./copy-button";

import type { ComponentProps, ReactNode } from "react";

// The chosen language (cURL / JavaScript / Python) is shared by every group on
// the page and remembered across pages.
const STORAGE_KEY = "docs-code-language";
const listeners = new Set<() => void>();
let memoryLanguage: string | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readLanguage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLanguage(language: string) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable (private mode); the tab still switches below.
  }
  memoryLanguage = language;
  listeners.forEach((listener) => listener());
}

type CodeChild = { title: string; pre: ComponentProps<"pre"> };

/** Tabs over consecutive fenced code blocks, each labelled by its `title` meta. */
export function CodeGroup({ children }: { children: ReactNode }) {
  const blocks: CodeChild[] = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<ComponentProps<"pre">>(child)) return [];
    return [{ title: child.props.title ?? "Code", pre: child.props }];
  });
  const titles = blocks.map((block) => block.title);

  const stored = useSyncExternalStore(
    subscribe,
    () => memoryLanguage ?? readLanguage(),
    () => null,
  );
  const active = stored && titles.includes(stored) ? stored : titles[0];
  const panels = useRef(new Map<string, HTMLPreElement>());

  if (!active) return null;

  return (
    <TabsPrimitive.Root
      value={active}
      onValueChange={writeLanguage}
      className={codeSurfaceClass}
    >
      <div className="flex items-center justify-between gap-2 border-b border-neutral-950/[0.07] pl-2 pr-1 dark:border-white/10">
        <TabsPrimitive.List aria-label="Code language" className="flex min-w-0 overflow-x-auto">
          {titles.map((title) => (
            <TabsPrimitive.Trigger
              key={title}
              value={title}
              className="relative whitespace-nowrap px-2.5 py-2.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-900 data-[state=active]:text-neutral-900 data-[state=active]:after:absolute data-[state=active]:after:inset-x-2.5 data-[state=active]:after:-bottom-px data-[state=active]:after:h-px data-[state=active]:after:bg-neutral-900 dark:text-neutral-400 dark:hover:text-white dark:focus-visible:outline-white dark:data-[state=active]:text-white dark:data-[state=active]:after:bg-white"
            >
              {title}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        <CopyButton getText={() => panels.current.get(active)?.textContent ?? ""} />
      </div>
      {blocks.map(({ title, pre }) => {
        const { children: code, ...preProps } = pre;
        return (
          <TabsPrimitive.Content key={title} value={title} tabIndex={-1}>
            <pre
              {...preProps}
              title={undefined}
              ref={(node) => {
                if (node) panels.current.set(title, node);
              }}
            >
              {code}
            </pre>
          </TabsPrimitive.Content>
        );
      })}
    </TabsPrimitive.Root>
  );
}
