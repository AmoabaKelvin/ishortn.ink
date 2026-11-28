"use client";

import { IconShare } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ShareStatsDialog } from "./share-stats-dialog";

export function ShareStatsButton({ linkId }: { linkId: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 gap-1.5 border-neutral-200 bg-white px-3 text-[13px] text-neutral-700 dark:border-border dark:bg-card dark:text-neutral-300"
      >
        <IconShare size={14} stroke={1.5} className="text-neutral-400 dark:text-muted-foreground" />
        Share
      </Button>
      <ShareStatsDialog linkId={linkId} open={open} onOpenChange={setOpen} />
    </>
  );
}
