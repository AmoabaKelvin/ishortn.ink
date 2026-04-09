"use client";

import {
  IconDeviceDesktop,
  IconMoon,
  IconSun,
} from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const options = [
  { value: "light", icon: IconSun, label: "Light" },
  { value: "dark", icon: IconMoon, label: "Dark" },
  { value: "system", icon: IconDeviceDesktop, label: "System" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex gap-0.5 rounded-xl bg-neutral-50 p-1 dark:bg-white/5">
        {options.map((option) => (
          <div
            key={option.value}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-neutral-400 dark:text-neutral-500"
          >
            <option.icon size={14} stroke={1.5} />
            <span className="text-[13px] font-medium">{option.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div role="group" aria-label="Theme" className="flex gap-0.5 rounded-xl bg-neutral-50 p-1 dark:bg-white/5">
      {options.map((option) => {
        const isActive = theme === option.value;
        return (
          <button
            type="button"
            key={option.value}
            aria-pressed={isActive}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors",
              isActive
                ? "bg-neutral-100 text-neutral-900 dark:bg-white/10 dark:text-white"
                : "text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300",
            )}
          >
            <option.icon size={14} stroke={1.5} />
            <span className="text-[13px] font-medium">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
