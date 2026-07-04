"use client";

import { IconLock } from "@tabler/icons-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trackUpgradeClick } from "@/lib/analytics/upgrade-prompt";
import { normalizeCampaignSlug } from "@/lib/campaigns/slug";
import type { Plan } from "@/lib/billing/plans";
import { api } from "@/trpc/react";
import type { RouterOutputs } from "@/trpc/shared";

type CampaignData = RouterOutputs["campaign"]["get"];

// GA4-recognized mediums so campaign traffic doesn't land in "Unassigned".
const MEDIUM_SUGGESTIONS = [
  "email",
  "social",
  "cpc",
  "display",
  "referral",
  "affiliate",
];

const toDateInput = (date: Date | null): string =>
  date ? date.toISOString().slice(0, 10) : "";

export function CampaignSettings({
  campaign,
  plan,
}: {
  campaign: CampaignData;
  plan: Plan;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const canUseUtm = plan !== "free";

  const [name, setName] = useState(campaign.name);
  const [slug, setSlug] = useState(campaign.slug);
  const [description, setDescription] = useState(campaign.description ?? "");
  const [startDate, setStartDate] = useState(toDateInput(campaign.startDate));
  const [endDate, setEndDate] = useState(toDateInput(campaign.endDate));
  const [utmSource, setUtmSource] = useState(campaign.utmSource ?? "");
  const [utmMedium, setUtmMedium] = useState(campaign.utmMedium ?? "");
  const [utmTerm, setUtmTerm] = useState(campaign.utmTerm ?? "");
  const [utmContent, setUtmContent] = useState(campaign.utmContent ?? "");

  // Same normalization the server applies, so the preview and the input
  // always show exactly what will be persisted.
  const normalizedSlug = normalizeCampaignSlug(slug);

  const update = api.campaign.update.useMutation({
    onSuccess: (res) => {
      toast.success("Campaign updated.");
      setSlug(res.slug);
      void utils.campaign.get.invalidate({ id: campaign.id });
      void utils.campaign.listNames.invalidate();
      // The detail route is slug-based — follow a renamed slug to its new URL.
      if (res.slug !== campaign.slug) {
        router.replace(`/dashboard/campaigns/${res.slug}`);
      } else {
        router.refresh();
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSave = () => {
    update.mutate({
      id: campaign.id,
      name: name.trim(),
      slug: normalizedSlug,
      description: description.trim() || null,
      // Save as UTC day boundaries; readers format with timeZone: "UTC" so
      // the dates round-trip without drifting across timezones.
      startDate: startDate ? new Date(`${startDate}T00:00:00Z`) : null,
      endDate: endDate ? new Date(`${endDate}T23:59:59Z`) : null,
      ...(canUseUtm && {
        utmSource: utmSource.trim() || null,
        utmMedium: utmMedium.trim() || null,
        utmTerm: utmTerm.trim() || null,
        utmContent: utmContent.trim() || null,
      }),
    });
  };

  const canSave =
    name.trim().length > 0 && normalizedSlug.length > 0 && !update.isLoading;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card className="rounded-xl border-neutral-200 p-5 shadow-none dark:border-border">
          <h3 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            General
          </h3>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="campaign-name">Name</Label>
                <Input
                  id="campaign-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-slug">Slug (utm_campaign)</Label>
                <Input
                  id="campaign-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  maxLength={100}
                />
                <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
                  Changing this only affects links tagged from now on.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="campaign-description">Description</Label>
              <Textarea
                id="campaign-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="What is this campaign for?"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="campaign-start">Start date</Label>
                <Input
                  id="campaign-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-end">End date</Label>
                <Input
                  id="campaign-end"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
              Dates only affect how the campaign is labeled — links keep working
              either way.
            </p>
          </div>
        </Card>

        <Card className="rounded-xl border-neutral-200 p-5 shadow-none dark:border-border">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
                UTM defaults
              </h3>
              <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-neutral-500">
                Auto-applied to links created in or added to this campaign.{" "}
                <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px] dark:bg-muted">
                  utm_campaign={normalizedSlug || campaign.slug}
                </code>{" "}
                always comes from the slug.
              </p>
            </div>
            {!canUseUtm && (
              <a
                href="/dashboard/pricing"
                onClick={() => trackUpgradeClick("campaign_utm_defaults")}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-medium text-white dark:bg-foreground dark:text-background"
              >
                <IconLock size={11} stroke={2} />
                Pro
              </a>
            )}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-utm-source">utm_source</Label>
              <Input
                id="campaign-utm-source"
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
                placeholder="newsletter"
                maxLength={255}
                disabled={!canUseUtm}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-utm-medium">utm_medium</Label>
              <Input
                id="campaign-utm-medium"
                value={utmMedium}
                onChange={(e) => setUtmMedium(e.target.value)}
                placeholder="email"
                maxLength={255}
                disabled={!canUseUtm}
                list="campaign-medium-suggestions"
              />
              <datalist id="campaign-medium-suggestions">
                {MEDIUM_SUGGESTIONS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
                Lowercase; GA4 mediums like email, cpc, social keep reports
                clean.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-utm-term">utm_term</Label>
              <Input
                id="campaign-utm-term"
                value={utmTerm}
                onChange={(e) => setUtmTerm(e.target.value)}
                maxLength={255}
                disabled={!canUseUtm}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-utm-content">utm_content</Label>
              <Input
                id="campaign-utm-content"
                value={utmContent}
                onChange={(e) => setUtmContent(e.target.value)}
                maxLength={255}
                disabled={!canUseUtm}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!canSave}>
          {update.isLoading ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
