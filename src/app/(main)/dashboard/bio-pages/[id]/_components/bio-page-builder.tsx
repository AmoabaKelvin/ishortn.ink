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
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  BioRenderer,
  type BioRenderBlock,
  type BioRenderModel,
} from "@/components/bio/bio-renderer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { UpgradeCta } from "@/components/upgrade-cta";
import { notifyPlanLimit } from "@/lib/analytics/upgrade-prompt";
import { getBioLinkBlockLimit } from "@/lib/billing/plans";
import { isPlanLimitError, requiredPlanForLimit } from "@/lib/billing/required-plan";
import { api } from "@/trpc/react";

import { useUpgradeOffer } from "../../../_components/upgrade-offer";
import { AnalyticsPanel } from "./analytics-panel";
import { BlockFormDialog } from "./block-form-dialog";
import { BlockList } from "./block-list";
import { PageQrDialog } from "./page-qr-dialog";
import { SettingsPanel } from "./settings-panel";
import {
  formatMutationError,
  getBlockPreviewNote,
  getSlugError,
  isDraftDirty,
  toSettingsDraft,
  type BioSettingsDraft,
} from "./utils";

import type { Plan } from "@/lib/billing/plans";
import type { BioBlockType } from "@/server/db/schema";
import type { RouterOutputs } from "@/trpc/shared";

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

// Upgrade source for a plan rejection on save, from the gate named in the message.
function bioSettingsLimitSource(message: string): string {
  if (/branding/i.test(message)) return "bio_branding";
  if (/custom domain/i.test(message)) return "bio_custom_domain";
  if (/theme/i.test(message)) return "bio_theme";
  return "bio_settings";
}

export function BioPageBuilder({
  pageId,
  initialData,
  plan,
  initialTab = "content",
}: {
  pageId: number;
  initialData: BioPageData;
  plan: Plan;
  initialTab?: "content" | "design" | "analytics";
}) {
  const utils = api.useUtils();
  const router = useRouter();
  const { data } = api.bioPage.get.useQuery(
    { id: pageId },
    { initialData, refetchOnWindowFocus: false },
  );
  const page = data ?? initialData;

  const [settings, setSettings] = useState<BioSettingsDraft>(() => toSettingsDraft(page));
  const [adding, setAdding] = useState<BioBlockType | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  // Fixed at mount: only used to label scheduled blocks in the preview.
  const [now] = useState(Date.now);

  const dirty = isDraftDirty(settings, toSettingsDraft(page));

  // Guard Design edits against leaving: the browser prompt covers reloads, tab
  // closes and external links; in-app links are intercepted in the capture phase,
  // before Next's Link handler, and confirmed with a dialog.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const linkBlockLimit = getBioLinkBlockLimit(plan);
  const linkBlockCount = page.blocks.filter((b) => b.type === "link").length;
  const atLinkBlockLimit = linkBlockLimit !== undefined && linkBlockCount >= linkBlockLimit;

  const refresh = () => utils.bioPage.get.invalidate({ id: pageId });

  const upgradeOffer = useUpgradeOffer();
  const updatePage = api.bioPage.update.useMutation({
    onSuccess: async () => {
      toast.success("Changes saved.");
      await refresh();
      // The server normalises some fields (uploaded images become URLs, domains are
      // lowercased), so re-seed the draft from the saved page to make it clean again.
      const saved = utils.bioPage.get.getData({ id: pageId });
      if (saved) setSettings(toSettingsDraft(saved));
    },
    onError: (e) => {
      if (isPlanLimitError(e)) {
        notifyPlanLimit(e.message, bioSettingsLimitSource(e.message), "pro", upgradeOffer);
        return;
      }
      toast.error(formatMutationError(e));
    },
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
    onError: (e) => {
      if (isPlanLimitError(e)) {
        notifyPlanLimit(
          e.message,
          /schedul/i.test(e.message) ? "bio_scheduled_blocks" : "bio_link_block_limit",
          requiredPlanForLimit(e.message, plan),
          upgradeOffer,
        );
        return;
      }
      toast.error(formatMutationError(e));
    },
  });

  function saveSettings() {
    if (!dirty || getSlugError(settings.slug)) return;
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
    slug: page.slug,
    title: settings.title || null,
    description: settings.description || null,
    avatarUrl: settings.avatarUrl,
    theme: settings.theme,
    removeBranding: settings.removeBranding,
    // Unlike the public page, keep hidden, scheduled and blocked blocks but label
    // them, so the preview explains why the live page differs.
    blocks: page.blocks.map((b) => ({
      ...toRenderBlock(b),
      previewNote: getBlockPreviewNote(b, now),
    })),
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard/bio-pages"
            aria-label="Back to bio pages"
            className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-muted"
          >
            <IconArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight text-neutral-900 dark:text-foreground">
              {page.title || `/${page.slug}`}
            </h2>
            <p className="truncate text-[12px] text-neutral-400 dark:text-neutral-500">
              {page.customDomain || `ishortn.ink/p/${page.slug}`}
            </p>
          </div>
          {page.isPublished ? (
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
            >
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
          <Tabs defaultValue={initialTab}>
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
                    <DropdownMenuItem
                      key={opt.type}
                      disabled={opt.type === "link" && atLinkBlockLimit}
                      onSelect={() => handleAdd(opt.type)}
                    >
                      <opt.icon size={16} className="mr-2 text-neutral-500" />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {atLinkBlockLimit && (
                <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-500/10">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-amber-700 dark:text-amber-400">
                      Link block limit reached
                    </p>
                    <p className="mt-0.5 text-[12px] text-amber-700 dark:text-amber-400">
                      Free bio pages can have up to {linkBlockLimit} link blocks. Upgrade to Pro for
                      unlimited link blocks.
                    </p>
                  </div>
                  <UpgradeCta
                    requiredPlan="pro"
                    source="bio_link_block_limit"
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Upgrade
                  </UpgradeCta>
                </div>
              )}

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
                dirty={dirty}
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
              <div className="h-[640px] overflow-y-auto overflow-x-hidden">
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

      <AlertDialog open={pendingHref !== null} onOpenChange={(o) => !o && setPendingHref(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your Design changes haven&apos;t been saved. If you leave now, they&apos;ll be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (pendingHref) router.push(pendingHref);
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
