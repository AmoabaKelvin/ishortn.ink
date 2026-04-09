"use client";

import {
  IconArrowsExchange,
  IconCreditCard,
  IconKey,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const navItems = [
  { id: "profile", label: "Profile", icon: IconUser },
  { id: "general", label: "General", icon: IconSettings },
  { id: "billing", label: "Billing", icon: IconCreditCard },
  { id: "api-keys", label: "API Keys", icon: IconKey },
  { id: "account-transfer", label: "Transfer", icon: IconArrowsExchange },
];

export function SettingsNav() {
  const [activeSection, setActiveSection] = useState("profile");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0,
      }
    );

    navItems.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav className="hidden lg:block w-44 flex-shrink-0">
      <div className="sticky top-24">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                  activeSection === item.id
                    ? "bg-neutral-100 dark:bg-muted text-neutral-900 dark:text-foreground"
                    : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-700 dark:hover:text-neutral-200"
                )}
              >
                <Icon size={15} stroke={1.5} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
