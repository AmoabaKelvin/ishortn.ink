"use client";

import { IconPlus, IconTrash } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SOCIAL_PLATFORMS, socialIcon } from "@/components/bio/social-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import type { RouterOutputs } from "@/trpc/shared";
import type { BioBlockType } from "@/server/db/schema";

import { DateTimePicker } from "./date-time-picker";

type EditorBlock = RouterOutputs["bioPage"]["get"]["blocks"][number];
type Social = { platform: string; url: string; key: string };

const TYPE_LABELS: Record<BioBlockType, string> = {
  link: "Link button",
  heading: "Heading",
  text: "Text",
  email: "Email button",
  social: "Social icons",
  divider: "Divider",
};

type Props = {
  pageId: number;
  mode: "add" | "edit";
  type: BioBlockType;
  block?: EditorBlock;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  canSchedule: boolean;
};

export function BlockFormDialog({
  pageId,
  mode,
  type,
  block,
  open,
  onOpenChange,
  onSaved,
  canSchedule,
}: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [socials, setSocials] = useState<Social[]>([]);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [scheduledUntil, setScheduledUntil] = useState<Date | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(block?.title ?? "");
    setContent(block?.content ?? "");
    setUrl(block?.url ?? "");
    setSocials(
      block?.socials && block.socials.length > 0
        ? block.socials.map((s) => ({ ...s, key: crypto.randomUUID() }))
        : type === "social"
          ? [{ platform: "website", url: "", key: crypto.randomUUID() }]
          : [],
    );
    setScheduledAt(block?.scheduledAt ? new Date(block.scheduledAt) : null);
    setScheduledUntil(block?.scheduledUntil ? new Date(block.scheduledUntil) : null);
  }, [open, block, type]);

  const mutationOptions = {
    onSuccess: () => {
      onOpenChange(false);
      onSaved();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const addBlock = api.bioPage.addBlock.useMutation(mutationOptions);
  const updateBlock = api.bioPage.updateBlock.useMutation(mutationOptions);

  const pending = addBlock.isLoading || updateBlock.isLoading;

  function submit() {
    const cleanSocials = socials
      .filter((s) => s.url.trim() !== "")
      .map(({ platform, url }) => ({ platform, url }));
    const payload = {
      title: title.trim() || null,
      content: type === "text" ? content : null,
      url: type === "link" || type === "email" ? url.trim() || null : null,
      socials: type === "social" ? cleanSocials : undefined,
    };

    if (type === "link" && !payload.url) return toast.error("Add a destination URL.");
    if (type === "email" && !payload.url) return toast.error("Add an email address.");

    // Only thread scheduling for Ultra; otherwise leave it untouched.
    const schedule = canSchedule ? { scheduledAt, scheduledUntil } : {};

    if (mode === "add") {
      addBlock.mutate({ bioPageId: pageId, type, ...payload, ...schedule });
    } else if (block) {
      updateBlock.mutate({ id: block.id, ...payload, ...schedule });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add" : "Edit"} {TYPE_LABELS[type].toLowerCase()}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4 overflow-y-auto">
          {(type === "link" || type === "email") && (
            <div className="space-y-1.5">
              <Label htmlFor="block-title">Label</Label>
              <Input
                id="block-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={type === "email" ? "Email me" : "Visit my store"}
              />
            </div>
          )}

          {type === "heading" && (
            <div className="space-y-1.5">
              <Label htmlFor="block-title">Heading</Label>
              <Input
                id="block-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My links"
              />
            </div>
          )}

          {type === "link" && (
            <div className="space-y-1.5">
              <Label htmlFor="block-url">Destination URL</Label>
              <Input
                id="block-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
              <p className="text-[12px] text-muted-foreground">
                We create a tracked short link automatically, so clicks show up in your analytics.
              </p>
            </div>
          )}

          {type === "email" && (
            <div className="space-y-1.5">
              <Label htmlFor="block-url">Email address</Label>
              <Input
                id="block-url"
                type="email"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="hello@example.com"
              />
            </div>
          )}

          {type === "text" && (
            <div className="space-y-1.5">
              <Label htmlFor="block-content">Text</Label>
              <Textarea
                id="block-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Say something about yourself…"
                rows={4}
              />
            </div>
          )}

          {type === "social" && (
            <div className="space-y-2.5">
              <Label>Social links</Label>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {socials.map((social, i) => {
                    const Icon = socialIcon(social.platform);
                    return (
                      <motion.div
                        key={social.key}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                        className="flex items-center gap-2"
                      >
                        <Select
                          value={social.platform}
                          onValueChange={(v) =>
                            setSocials((prev) =>
                              prev.map((s, idx) => (idx === i ? { ...s, platform: v } : s)),
                            )
                          }
                        >
                          <SelectTrigger aria-label="Platform" className="w-16 shrink-0 px-2.5">
                            <Icon size={18} stroke={1.5} />
                          </SelectTrigger>
                          <SelectContent>
                            {SOCIAL_PLATFORMS.map((p) => {
                              const PIcon = p.icon;
                              return (
                                <SelectItem key={p.value} value={p.value}>
                                  <span className="flex items-center gap-2">
                                    <PIcon size={16} stroke={1.5} />
                                    {p.label}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <Input
                          value={social.url}
                          onChange={(e) =>
                            setSocials((prev) =>
                              prev.map((s, idx) => (idx === i ? { ...s, url: e.target.value } : s)),
                            )
                          }
                          placeholder={
                            social.platform === "email"
                              ? "you@example.com"
                              : social.platform === "website"
                                ? "https://yoursite.com"
                                : "@handle or URL"
                          }
                          className="flex-1"
                        />
                        <button
                          type="button"
                          aria-label="Remove social link"
                          onClick={() => setSocials((prev) => prev.filter((_, idx) => idx !== i))}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                        >
                          <IconTrash size={16} stroke={1.5} />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSocials((prev) => [
                    ...prev,
                    { platform: "website", url: "", key: crypto.randomUUID() },
                  ])
                }
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 py-2.5 text-[13px] font-medium text-neutral-600 transition-colors hover:border-blue-400 hover:bg-blue-50/60 hover:text-blue-600 dark:border-border dark:text-neutral-400 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10"
              >
                <IconPlus size={15} stroke={1.5} />
                Add social link
              </button>
            </div>
          )}

          {canSchedule && (
            <div className="space-y-2 border-t border-neutral-100 pt-4 dark:border-border">
              <Label className="text-[12px] text-muted-foreground">Schedule (optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="block text-[12px] text-neutral-500">Show from</span>
                  <DateTimePicker
                    value={scheduledAt}
                    onChange={setScheduledAt}
                    placeholder="Anytime"
                  />
                </div>
                <div className="space-y-1">
                  <span className="block text-[12px] text-neutral-500">Hide after</span>
                  <DateTimePicker
                    value={scheduledUntil}
                    onChange={setScheduledUntil}
                    placeholder="Never"
                  />
                </div>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : mode === "add" ? "Add block" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
