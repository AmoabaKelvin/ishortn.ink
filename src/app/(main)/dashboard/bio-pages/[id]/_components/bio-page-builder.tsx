"use client";

import {
  IconAlignLeft,
  IconArrowLeft,
  IconChevronDown,
  IconExternalLink,
  IconHeading,
  IconLine,
  IconLink,
  IconMail,
  IconPlus,
  IconWorld,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { useState } from "react";
import { toast } from "sonner";

import { BioRenderer, type BioRenderBlock, type BioRenderModel } from "@/components/bio/bio-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Plan } from "@/lib/billing/plans";
import { api } from "@/trpc/react";
import type { RouterOutputs } from "@/trpc/shared";
import type { BioBlockType } from "@/server/db/schema";

import { AnalyticsPanel } from "./analytics-panel";
import { BlockFormDialog } from "./block-form-dialog";
import { BlockList } from "./block-list";
import { PageQrDialog } from "./page-qr-dialog";
import { SettingsPanel, type BioSettingsDraft } from "./settings-panel";

type BioPageData = RouterOutputs["bioPage"]["get"];
type EditorBlock = BioPageData["blocks"][number];

const ADD_OPTIONS: { type: BioBlockType; label: string; icon: typeof IconLink }[] = [
  { type: "link", label: "Link", icon: IconLink },
  { type: "heading", label: "Heading", icon: IconHeading },
  { type: "text", label: "Text", icon: IconAlignLeft },
  { type: "social", label: "Social icons", icon: IconWorld },
  { type: "email", label: "Email button", icon: IconMail },
  { type: "divider", label: "Divider", icon: IconLine },
];

function toRenderBlock(b: EditorBlock): BioRenderBlock {
  switch (b.type) {
    case "link":
      return { id: b.id, type: "link", title: b.title, href: b.shortUrl };
    case "email":
      return { id: b.id, type: "email", title: b.title, href: b.url ? `mailto:${b.url}` : null };
    case "heading":
      return { id: b.id, type: "heading", title: b.title };
    case "text":
      return { id: b.id, type: "text", content: b.content };
    case "social":
      return { id: b.id, type: "social", socials: b.socials ?? [] };
    default:
      return { id: b.id, type: "divider" };
  }
}

export function BioPageBuilder({
  pageId,
  initialData,
  plan,
}: {
  pageId: number;
  initialData: BioPageData;
  plan: Plan;
}) {
  const utils = api.useUtils();
  const { data } = api.bioPage.get.useQuery(
    { id: pageId },
    { initialData, refetchOnWindowFocus: false },
  );
  const page = data ?? initialData;

  const [settings, setSettings] = useState<BioSettingsDraft>(() => ({
    slug: page.slug,
    title: page.title ?? "",
    description: page.description ?? "",
    avatarUrl: page.avatarUrl ?? null,
    theme: page.theme ?? {},
    removeBranding: page.removeBranding ?? false,
    customDomain: page.customDomain ?? "",
    socialImageUrl: page.socialImageUrl ?? null,
  }));
  const [adding, setAdding] = useState<BioBlockType | null>(null);

  const refresh = () => utils.bioPage.get.invalidate({ id: pageId });

  const updatePage = api.bioPage.update.useMutation({
    onSuccess: () => {
      toast.success("Changes saved.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const togglePublished = api.bioPage.togglePublished.useMutation({
    onSuccess: (res) => {
      toast.success(res.isPublished ? "Your bio page is live." : "Your bio page is now a draft.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const addBlock = api.bioPage.addBlock.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });

  function saveSettings() {
    updatePage.mutate({
      id: pageId,
      slug: settings.slug,
      title: settings.title || null,
      description: settings.description || null,
      avatarUrl: settings.avatarUrl,
      theme: settings.theme,
      removeBranding: settings.removeBranding,
      customDomain: settings.customDomain.trim() || null,
      socialImageUrl: settings.socialImageUrl,
    });
  }

  function handleAdd(type: BioBlockType) {
    if (type === "divider") {
      addBlock.mutate({ bioPageId: pageId, type: "divider" });
    } else {
      setAdding(type);
    }
  }

  const previewModel: BioRenderModel = {
    title: settings.title || null,
    description: settings.description || null,
    avatarUrl: settings.avatarUrl,
    theme: settings.theme,
    removeBranding: settings.removeBranding,
    blocks: page.blocks.filter((b) => b.isVisible).map(toRenderBlock),
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/bio-pages"
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-muted"
          >
            <IconArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-foreground">
              {page.title || `/${page.slug}`}
            </h2>
            <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
              ishortn.ink/p/{page.slug}
            </p>
          </div>
          {page.isPublished ? (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              Live
            </Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          <PageQrDialog slug={page.slug} />
          {page.isPublished && (
            <a
              href={`/p/${page.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[13px] text-neutral-500 hover:text-neutral-800 dark:hover:text-foreground"
            >
              View <IconExternalLink size={14} />
            </a>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-neutral-500">Published</span>
            <Switch
              checked={page.isPublished ?? false}
              onCheckedChange={(checked) =>
                togglePublished.mutate({ id: pageId, isPublished: checked })
              }
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Editor — takes the remaining width; the preview is a fixed right rail */}
        <div className="min-w-0 flex-1">
          <Tabs defaultValue="content">
            <TabsList>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent
              value="content"
              className="mt-4 max-w-2xl space-y-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-300"
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="w-full">
                    <IconPlus size={16} className="mr-1.5" /> Add block
                    <IconChevronDown size={14} className="ml-1.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  {ADD_OPTIONS.map((opt) => (
                    <DropdownMenuItem key={opt.type} onSelect={() => handleAdd(opt.type)}>
                      <opt.icon size={16} className="mr-2 text-neutral-500" />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <BlockList
                pageId={pageId}
                blocks={page.blocks}
                onChanged={refresh}
                canSchedule={plan === "ultra"}
              />
            </TabsContent>

            <TabsContent
              value="design"
              className="mt-4 max-w-2xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-300"
            >
              <SettingsPanel
                value={settings}
                onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
                plan={plan}
                onSave={saveSettings}
                saving={updatePage.isLoading}
              />
            </TabsContent>

            <TabsContent
              value="analytics"
              className="mt-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-300"
            >
              <AnalyticsPanel pageId={pageId} plan={plan} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Live preview — fixed right rail, aligned under the header actions */}
        <div className="shrink-0 lg:sticky lg:top-6 lg:w-[360px]">
          <div className="mx-auto w-full max-w-[360px]">
            <div className="overflow-hidden rounded-[2rem] border-[6px] border-neutral-800 bg-white shadow-xl dark:border-neutral-700">
              <div className="h-[640px] overflow-y-auto">
                <BioRenderer model={previewModel} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {adding && (
        <BlockFormDialog
          pageId={pageId}
          mode="add"
          type={adding}
          open={adding !== null}
          onOpenChange={(o) => !o && setAdding(null)}
          onSaved={refresh}
          canSchedule={plan === "ultra"}
        />
      )}
    </div>
  );
}
