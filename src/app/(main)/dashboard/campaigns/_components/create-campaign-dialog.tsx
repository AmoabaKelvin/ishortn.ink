"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifyPlanLimit } from "@/lib/analytics/upgrade-prompt";
import { normalizeCampaignSlug as normalizeSlug } from "@/lib/campaigns/slug";
import { api } from "@/trpc/react";

export function CreateCampaignDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");

  const create = api.campaign.create.useMutation({
    onSuccess: (res) => {
      toast.success("Campaign created.");
      void utils.campaign.listNames.invalidate();
      setOpen(false);
      router.push(`/dashboard/campaigns/${res.slug}`);
    },
    onError: (error) => {
      if (error.data?.code === "FORBIDDEN") {
        notifyPlanLimit(error.message, "campaign_create");
      } else {
        toast.error(error.message);
      }
    },
  });

  const effectiveSlug = normalizeSlug(slugTouched ? slug : name);
  const canCreate = name.trim().length > 0 && effectiveSlug.length > 0 && !create.isLoading;

  const reset = () => {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            Name the initiative you're tracking — a launch, event, or push. You can add links right
            after.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer Launch"
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-slug">Slug</Label>
            <Input
              id="campaign-slug"
              value={slugTouched ? slug : effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="summer-launch"
              maxLength={100}
            />
            <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
              Used as{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px] dark:bg-muted">
                utm_campaign={effectiveSlug || "…"}
              </code>{" "}
              on links this campaign tags.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-description">Description (optional)</Label>
            <Textarea
              id="campaign-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this campaign for?"
              rows={2}
              maxLength={2000}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            onClick={() =>
              create.mutate({
                name: name.trim(),
                slug: effectiveSlug,
                description: description.trim() || undefined,
              })
            }
            disabled={!canCreate}
          >
            {create.isLoading ? "Creating…" : "Create campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
