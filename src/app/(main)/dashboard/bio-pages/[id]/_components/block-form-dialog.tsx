"use client";

import { IconPlus, IconTrash } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";

import { DateTimePicker } from "@/app/(main)/dashboard/_components/date-time-picker";
import { SOCIAL_PLATFORMS, socialIcon } from "@/components/bio/social-icons";
import {
  WHATSAPP_DEFAULT_LABEL,
  WHATSAPP_MESSAGE_MAX,
  whatsappPhoneSchema,
} from "@/components/bio/whatsapp";
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
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { notifyPlanLimit } from "@/lib/analytics/upgrade-prompt";
import { api } from "@/trpc/react";

import { useUpgradeOffer } from "../../../_components/upgrade-offer";

import type { BioEditorBlockType } from "@/server/api/routers/bio-page/bio-page.input";
import type { RouterOutputs } from "@/trpc/shared";

type EditorBlock = RouterOutputs["bioPage"]["get"]["blocks"][number];
type Social = { platform: string; url: string; key: string };

const TYPE_LABELS = {
  link: "Link button",
  heading: "Heading",
  text: "Text",
  email: "Email button",
  whatsapp: "WhatsApp button",
  social: "Social icons",
  divider: "Divider",
} satisfies Record<BioEditorBlockType, string>;

type Props = {
  pageId: number;
  mode: "add" | "edit";
  type: BioEditorBlockType;
  block?: EditorBlock;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  canSchedule: boolean;
};

export function BlockFormDialog({ open, onOpenChange, ...form }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)_auto]">
        <BlockForm {...form} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function initialSocials(block: EditorBlock | undefined, type: BioEditorBlockType): Social[] {
  if (block?.socials && block.socials.length > 0) {
    return block.socials.map((s) => ({ ...s, key: crypto.randomUUID() }));
  }
  return type === "social" ? [{ platform: "website", url: "", key: crypto.randomUUID() }] : [];
}

// Mounted only while the dialog content is open, so the form state starts from
// the block every time the dialog opens.
function BlockForm({
  pageId,
  mode,
  type,
  block,
  onOpenChange,
  onSaved,
  canSchedule,
}: Omit<Props, "open">) {
  const [title, setTitle] = useState(
    block?.title ?? (mode === "add" && type === "whatsapp" ? WHATSAPP_DEFAULT_LABEL : ""),
  );
  const [phone, setPhone] = useState(block?.whatsapp?.phone ?? "");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [message, setMessage] = useState(block?.whatsapp?.message ?? "");
  const [content, setContent] = useState(block?.content ?? "");
  const [url, setUrl] = useState(block?.url ?? "");
  const [socials, setSocials] = useState(() => initialSocials(block, type));
  const [scheduledAt, setScheduledAt] = useState(
    block?.scheduledAt ? new Date(block.scheduledAt) : null,
  );
  const [scheduledUntil, setScheduledUntil] = useState(
    block?.scheduledUntil ? new Date(block.scheduledUntil) : null,
  );

  const mutationOptions = {
    onSuccess: () => {
      onOpenChange(false);
      onSaved();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const upgradeOffer = useUpgradeOffer();
  const addBlock = api.bioPage.addBlock.useMutation({
    ...mutationOptions,
    onError: (error) => {
      if (error.data?.code === "FORBIDDEN" && /upgrade/i.test(error.message)) {
        notifyPlanLimit(error.message, "bio_link_block_limit", "pro", upgradeOffer);
      } else {
        toast.error(error.message);
      }
    },
  });
  const updateBlock = api.bioPage.updateBlock.useMutation(mutationOptions);

  const pending = addBlock.isLoading || updateBlock.isLoading;

  function submit() {
    // Same schema the server validates with, so the field error matches it.
    const parsedPhone = type === "whatsapp" ? whatsappPhoneSchema.safeParse(phone) : null;
    if (parsedPhone && !parsedPhone.success) {
      return setPhoneError(parsedPhone.error.issues[0]?.message ?? "Enter a valid phone number.");
    }

    const cleanSocials = socials
      .filter((s) => s.url.trim() !== "")
      .map(({ platform, url }) => ({ platform, url }));
    const payload = {
      title: title.trim() || null,
      content: type === "text" ? content : null,
      url: type === "link" || type === "email" ? url.trim() || null : null,
      socials: type === "social" ? cleanSocials : undefined,
      whatsapp: parsedPhone ? { phone: parsedPhone.data, message: message.trim() } : undefined,
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
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "add" ? "Add" : "Edit"} {TYPE_LABELS[type].toLowerCase()}
        </DialogTitle>
      </DialogHeader>

      <DialogBody className="space-y-4 overflow-y-auto">
        {(type === "link" || type === "email" || type === "whatsapp") && (
          <div className="space-y-1.5">
            <Label htmlFor="block-title">Label</Label>
            <Input
              id="block-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "email"
                  ? "Email me"
                  : type === "whatsapp"
                    ? WHATSAPP_DEFAULT_LABEL
                    : "Visit my store"
              }
            />
          </div>
        )}

        {type === "whatsapp" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="block-phone">WhatsApp number</Label>
              <Input
                id="block-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneError(null);
                }}
                placeholder="+233241234567"
                aria-invalid={phoneError ? true : undefined}
                aria-describedby={phoneError ? "block-phone-error" : "block-phone-hint"}
              />
              {phoneError ? (
                <p id="block-phone-error" className="text-[12px] text-red-500">
                  {phoneError}
                </p>
              ) : (
                <p id="block-phone-hint" className="text-[12px] text-muted-foreground">
                  International format with the country code.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-message">Prefilled message (optional)</Label>
              <Textarea
                id="block-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi! I'd like to place an order."
                maxLength={WHATSAPP_MESSAGE_MAX}
                rows={3}
              />
              <p className="text-[12px] text-muted-foreground">
                Visitors can edit it before sending. Clicks are tracked in your analytics.
              </p>
            </div>
          </>
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
                <span className="block text-[12px] text-neutral-500 dark:text-neutral-400">
                  Show from
                </span>
                <DateTimePicker
                  value={scheduledAt}
                  onChange={setScheduledAt}
                  placeholder="Anytime"
                />
              </div>
              <div className="space-y-1">
                <span className="block text-[12px] text-neutral-500 dark:text-neutral-400">
                  Hide after
                </span>
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
    </>
  );
}
