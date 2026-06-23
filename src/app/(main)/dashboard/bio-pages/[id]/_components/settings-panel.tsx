"use client";

import { IconLock, IconUpload, IconX } from "@tabler/icons-react";
import { useRef } from "react";
import { toast } from "sonner";

import { BIO_PRESET_OPTIONS, BIO_PRESETS, resolveBioTheme } from "@/components/bio/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Plan } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import type { BioPageTheme } from "@/server/db/schema";

export type BioSettingsDraft = {
  slug: string;
  title: string;
  description: string;
  avatarUrl: string | null;
  theme: BioPageTheme;
  removeBranding: boolean;
  customDomain: string;
  socialImageUrl: string | null;
};

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const BUTTON_STYLES = [
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Pill" },
  { value: "sharp", label: "Sharp" },
  { value: "outline", label: "Outline" },
] as const;

const FONTS = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
  { value: "rounded", label: "Rounded" },
] as const;

type Props = {
  value: BioSettingsDraft;
  onChange: (patch: Partial<BioSettingsDraft>) => void;
  plan: Plan;
  onSave: () => void;
  saving: boolean;
};

export function SettingsPanel({ value, onChange, plan, onSave, saving }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const socialFileRef = useRef<HTMLInputElement>(null);
  const isPaid = plan !== "free";

  function patchTheme(patch: Partial<BioPageTheme>) {
    onChange({ theme: { ...value.theme, ...patch } });
  }

  function handleImage(file: File | undefined, key: "avatarUrl" | "socialImageUrl") {
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image must be under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => onChange({ [key]: reader.result as string });
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6">
      {/* Profile */}
      <section className="space-y-4">
        <h3 className="text-[13px] font-semibold text-neutral-900 dark:text-foreground">Profile</h3>

        <div className="space-y-1.5">
          <Label htmlFor="settings-slug">Handle</Label>
          <div className="flex h-9 items-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-border dark:bg-card dark:shadow-none">
            <span className="flex h-full select-none items-center border-r border-gray-200 bg-gray-50 px-3 text-[13px] text-gray-500 dark:border-border dark:bg-muted dark:text-gray-400">
              /p/
            </span>
            <input
              id="settings-slug"
              value={value.slug}
              onChange={(e) =>
                onChange({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-") })
              }
              className="h-full flex-1 bg-transparent px-3 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-500 dark:text-foreground dark:placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Avatar</Label>
          <div className="flex items-center gap-3">
            {value.avatarUrl ? (
              <span className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value.avatarUrl}
                  alt="Avatar"
                  className="h-14 w-14 rounded-full object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove avatar"
                  onClick={() => onChange({ avatarUrl: null })}
                  className="absolute -right-1 -top-1 rounded-full bg-neutral-800 p-0.5 text-white"
                >
                  <IconX size={12} />
                </button>
              </span>
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-muted">
                <IconUpload size={18} stroke={1.5} />
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Upload image
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => handleImage(e.target.files?.[0], "avatarUrl")}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-title">Title</Label>
          <Input
            id="settings-title"
            value={value.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Jane Doe"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-desc">Bio</Label>
          <Textarea
            id="settings-desc"
            value={value.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Designer, maker, coffee enthusiast."
            rows={3}
          />
        </div>
      </section>

      {/* Theme */}
      <section className="space-y-4">
        <h3 className="text-[13px] font-semibold text-neutral-900 dark:text-foreground">Theme</h3>

        <div className="grid grid-cols-3 gap-2">
          {BIO_PRESET_OPTIONS.map((presetId) => {
            const preset = BIO_PRESETS[presetId]!;
            const selected = (value.theme.preset ?? "minimal") === presetId;
            return (
              <button
                key={presetId}
                onClick={() => patchTheme({ preset: presetId })}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] capitalize transition-all",
                  selected
                    ? "border-blue-500 ring-1 ring-blue-500"
                    : "border-neutral-200 hover:border-neutral-300 dark:border-border",
                )}
                style={{ background: preset.background, color: preset.text }}
              >
                <span
                  className="h-4 w-10 rounded-full"
                  style={{ background: preset.accent }}
                />
                {presetId}
              </button>
            );
          })}
        </div>

        <PaidRow label="Accent color" isPaid={isPaid}>
          <input
            type="color"
            value={value.theme.accentColor ?? "#0a0a0a"}
            disabled={!isPaid}
            onChange={(e) => patchTheme({ accentColor: e.target.value })}
            className="h-9 w-14 cursor-pointer rounded border border-input bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
          />
        </PaidRow>

        <PaidRow label="Button style" isPaid={isPaid}>
          <Select
            value={value.theme.buttonStyle ?? ""}
            onValueChange={(v) => patchTheme({ buttonStyle: v as BioPageTheme["buttonStyle"] })}
            disabled={!isPaid}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Preset default" />
            </SelectTrigger>
            <SelectContent>
              {BUTTON_STYLES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PaidRow>

        <PaidRow label="Font" isPaid={isPaid}>
          <Select
            value={value.theme.font ?? ""}
            onValueChange={(v) => patchTheme({ font: v })}
            disabled={!isPaid}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Sans" />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PaidRow>
      </section>

      {/* Branding */}
      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-neutral-900 dark:text-foreground">Branding</h3>
        <PaidRow label='Remove "Made with iShortn"' isPaid={isPaid}>
          <Switch
            checked={value.removeBranding}
            disabled={!isPaid}
            onCheckedChange={(checked) => onChange({ removeBranding: checked })}
          />
        </PaidRow>
      </section>

      {/* Advanced */}
      <section className="space-y-4">
        <h3 className="text-[13px] font-semibold text-neutral-900 dark:text-foreground">Advanced</h3>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            Custom domain
            {!isPaid && <IconLock size={13} className="text-amber-500" />}
          </Label>
          <Input
            value={value.customDomain}
            disabled={!isPaid}
            onChange={(e) => onChange({ customDomain: e.target.value })}
            placeholder="links.yourbrand.com"
          />
          <p className="text-[12px] text-muted-foreground">
            Use a domain you've already verified under Domains. Your bio page loads at its root.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            Social preview image
            {!isPaid && <IconLock size={13} className="text-amber-500" />}
          </Label>
          <div className="flex items-center gap-3">
            {value.socialImageUrl ? (
              <span className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value.socialImageUrl}
                  alt="Social preview"
                  className="h-12 w-20 rounded object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove social preview image"
                  onClick={() => onChange({ socialImageUrl: null })}
                  className="absolute -right-1 -top-1 rounded-full bg-neutral-800 p-0.5 text-white"
                >
                  <IconX size={12} />
                </button>
              </span>
            ) : (
              <span className="flex h-12 w-20 items-center justify-center rounded bg-neutral-100 text-neutral-400 dark:bg-muted">
                <IconUpload size={16} stroke={1.5} />
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={!isPaid}
              onClick={() => socialFileRef.current?.click()}
            >
              Upload
            </Button>
            <input
              ref={socialFileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => handleImage(e.target.files?.[0], "socialImageUrl")}
            />
          </div>
        </div>
      </section>

      <Button onClick={onSave} disabled={saving} className="w-full">
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

function PaidRow({
  label,
  isPaid,
  children,
}: {
  label: string;
  isPaid: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-[13px] text-neutral-700 dark:text-foreground">
        {label}
        {!isPaid && <IconLock size={13} className="text-amber-500" />}
      </span>
      {children}
    </div>
  );
}
