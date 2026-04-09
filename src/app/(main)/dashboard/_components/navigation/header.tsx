"use client";

import { IconBrandDiscord, IconBrandGithub } from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { useState } from "react";

import { FeedbackModal } from "./feedback-modal";

const DashboardHeader = () => {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  return (
    <div className="flex items-center justify-end">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsFeedbackOpen(true)}
          className="text-[13px] text-neutral-500 dark:text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-foreground"
        >
          Feedback
        </button>
        <Link
          href="https://discord.gg/S66ZvMzkU4"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-400 dark:text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-foreground"
        >
          <IconBrandDiscord size={18} stroke={1.5} />
        </Link>
        <Link
          href="https://github.com/AmoabaKelvin/ishortn.ink"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-400 dark:text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-foreground"
        >
          <IconBrandGithub size={18} stroke={1.5} />
        </Link>
      </div>

      <FeedbackModal open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen} />
    </div>
  );
};

export { DashboardHeader as DashboardNav };
