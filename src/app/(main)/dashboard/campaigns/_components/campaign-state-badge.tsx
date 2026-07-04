import { Badge } from "@/components/ui/badge";

type DisplayState = "active" | "archived" | "scheduled" | "ended";

const STYLES: Record<DisplayState, { label: string; className?: string }> = {
  active: {
    label: "Active",
    className:
      "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/10",
  },
  scheduled: {
    label: "Scheduled",
    className:
      "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/10",
  },
  ended: {
    label: "Ended",
    className:
      "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/10",
  },
  archived: { label: "Archived" },
};

export function CampaignStateBadge({ state }: { state: DisplayState }) {
  const style = STYLES[state];
  return (
    <Badge variant="secondary" className={style.className}>
      {style.label}
    </Badge>
  );
}
