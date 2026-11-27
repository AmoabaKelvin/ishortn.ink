"use client";

import { useUser } from "@clerk/nextjs";
import {
  IconBan,
  IconChartBar,
  IconChevronUp,
  IconCreditCard,
  IconFlag,
  IconFolder,
  IconLayoutDashboard,
  IconLayoutList,
  IconLifebuoy,
  IconLink,
  IconLogout,
  IconMenu2,
  IconMailOff,
  IconMessageReport,
  IconMicrophone2,
  IconQrcode,
  IconReceipt,
  IconSettings,
  IconShieldLock,
  IconSpeakerphone,
  IconTarget,
  IconUser,
  IconUserPlus,
  IconUsers,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Wordmark } from "@/app/(landing)/_components/site-primitives";
import { useSignOut } from "@/components/scripts/posthog-identify";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

import { AudienceFeedbackPrompt } from "./audience-feedback-prompt";
import { FeedbackModal } from "./feedback-modal";
import { SidebarStats } from "./sidebar-stats";
import { ThemeToggle } from "./theme-toggle";
import { WorkspaceSwitcher } from "./workspace-switcher";

import type { EventUsage } from "./sidebar-stats";
import type { SidebarUpgradeSignals } from "./sidebar-upgrade-reason";

const sidebarWordmarkClass = "text-[17px] dark:text-foreground [&>svg]:size-5";

const navigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: IconLayoutDashboard },
  {
    name: "Analytics",
    href: "/dashboard/analytics/overview",
    icon: IconChartBar,
  },
  { name: "QR Codes", href: "/dashboard/qrcodes", icon: IconQrcode },
  { name: "Campaigns", href: "/dashboard/campaigns", icon: IconSpeakerphone },
  { name: "Bio Pages", href: "/dashboard/bio-pages", icon: IconLayoutList },
  { name: "Domains", href: "/dashboard/domains", icon: IconWorld },
  { name: "Folders", href: "/dashboard/folders", icon: IconFolder },
  { name: "UTM Templates", href: "/dashboard/utm-templates", icon: IconTarget },
  { name: "Settings", href: "/dashboard/settings", icon: IconSettings },
];

const teamNavigationItems = [
  { name: "Team Members", href: "/dashboard/teams/members", icon: IconUsers },
  {
    name: "Team Settings",
    href: "/dashboard/teams/settings",
    icon: IconSettings,
  },
];

const adminNavigationItems = [
  { name: "Overview", href: "/dashboard/admin", icon: IconShieldLock },
  { name: "Links", href: "/dashboard/admin/links", icon: IconLink },
  { name: "Users", href: "/dashboard/admin/users", icon: IconUsers },
  { name: "Signups", href: "/dashboard/admin/signups", icon: IconUserPlus },
  { name: "Entitlements", href: "/dashboard/admin/entitlements", icon: IconReceipt },
  { name: "Domains", href: "/dashboard/admin/domains", icon: IconBan },
  { name: "Flagged Links", href: "/dashboard/admin/flagged", icon: IconFlag },
  { name: "Feedback", href: "/dashboard/admin/feedback", icon: IconMessageReport },
  { name: "Email Health", href: "/dashboard/admin/email-health", icon: IconMailOff },
  {
    name: "Audience Feedback",
    href: "/dashboard/admin/audience-feedback",
    icon: IconMicrophone2,
  },
];

type Team = {
  id: number;
  name: string;
  slug: string;
  avatarUrl: string | null;
  role: "owner" | "admin" | "member";
};

type CurrentWorkspace = {
  type: "personal" | "team";
  teamId?: number;
  teamSlug?: string;
  teamName?: string;
  teamAvatar?: string | null;
  role?: "owner" | "admin" | "member";
  plan: "free" | "pro" | "ultra";
};

type AppSidebarProps = {
  userHasPaidPlan?: boolean;
  monthlyLinkCount?: number;
  totalLinks?: number;
  linkLimit?: number | null;
  eventUsage?: EventUsage | undefined;
  folderUsage?: { count: number; limit: number | null } | undefined;
  qrCodeUsage?: { count: number; limit: number | null } | undefined;
  upgradeSignals?: Promise<SidebarUpgradeSignals | null> | null;
  plan?: "free" | "pro" | "ultra";
  teams?: Team[];
  currentWorkspace?: CurrentWorkspace;
  canCreateTeam?: boolean;
  isAdmin?: boolean;
  userName?: string | null;
};

export function AppSidebar({
  userHasPaidPlan = false,
  monthlyLinkCount = 0,
  linkLimit = null,
  eventUsage,
  folderUsage,
  qrCodeUsage,
  upgradeSignals = null,
  plan = "free",
  teams = [],
  currentWorkspace = { type: "personal", plan: "free" },
  canCreateTeam = false,
  isAdmin = false,
  userName = null,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  // The menu belongs to the page it was opened on, so any navigation (upgrade
  // links, create team, …) closes it without an effect.
  const [menuOpenPath, setMenuOpenPath] = useState<string | null>(null);
  const isMobileMenuOpen = menuOpenPath === pathname;
  const setIsMobileMenuOpen = (open: boolean) => setMenuOpenPath(open ? pathname : null);
  // Below lg the sidebar stays mounted off-canvas while the menu is closed.
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const { user } = useUser();
  const signOut = useSignOut();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // The DB name is what settings edits; Clerk's name and the email are only fallbacks.
  const displayName =
    userName ||
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress.split("@")[0] ||
    "User";

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpenPath(null);
      openButtonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobileMenuOpen]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-neutral-200 bg-white px-4 dark:border-border dark:bg-card lg:hidden">
        <button
          ref={openButtonRef}
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="-ml-1.5 rounded-md p-1.5 text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-accent"
          aria-label="Open menu"
          aria-expanded={isMobileMenuOpen}
          aria-controls="dashboard-sidebar"
        >
          <IconMenu2 size={20} stroke={1.5} />
        </button>
        <Link href="/dashboard">
          <Wordmark className={sidebarWordmarkClass} />
        </Link>
      </div>

      {/* Sidebar */}
      <aside
        id="dashboard-sidebar"
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-[280px] flex-col border-r border-neutral-200 dark:border-border bg-white dark:bg-card transition-transform duration-200 ease-in-out lg:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 shrink-0 items-center justify-between px-5">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
              <Wordmark className={sidebarWordmarkClass} />
            </Link>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                openButtonRef.current?.focus();
              }}
              className="-mr-1.5 rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-accent dark:hover:text-foreground lg:hidden"
              aria-label="Close menu"
            >
              <IconX size={18} stroke={1.5} />
            </button>
          </div>

          {/* Workspace Switcher */}
          <div className="px-3 pb-2">
            <WorkspaceSwitcher
              teams={teams}
              currentWorkspace={currentWorkspace}
              canCreateTeam={canCreateTeam}
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 pt-2">
            <ul className="space-y-0.5">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                        isActive
                          ? "bg-neutral-100 dark:bg-muted text-neutral-900 dark:text-foreground"
                          : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-900 dark:hover:text-foreground",
                      )}
                    >
                      <Icon size={18} stroke={1.5} className="shrink-0" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Team Navigation */}
            {currentWorkspace.type === "team" && (
              <>
                <div className="my-3 h-px bg-neutral-100 dark:bg-border/50" />
                <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-muted-foreground">
                  Team
                </p>
                <ul className="space-y-0.5">
                  {teamNavigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname.startsWith(item.href);

                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                            isActive
                              ? "bg-neutral-100 dark:bg-muted text-neutral-900 dark:text-foreground"
                              : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-900 dark:hover:text-foreground",
                          )}
                        >
                          <Icon size={18} stroke={1.5} className="shrink-0" />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {/* Admin Navigation */}
            {isAdmin && (
              <>
                <div className="my-3 h-px bg-neutral-100 dark:bg-border/50" />
                <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-muted-foreground">
                  Admin
                </p>
                <ul className="space-y-0.5">
                  {adminNavigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard/admin" && pathname.startsWith(item.href));

                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                            isActive
                              ? "bg-neutral-100 dark:bg-muted text-neutral-900 dark:text-foreground"
                              : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-900 dark:hover:text-foreground",
                          )}
                        >
                          <Icon size={18} stroke={1.5} className="shrink-0" />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </nav>

          {/* Footer */}
          <div className="shrink-0">
            {/* Stats — personal workspace only */}
            {currentWorkspace.type === "personal" && (
              <div className="px-3 pb-2">
                <SidebarStats
                  monthlyLinkCount={monthlyLinkCount}
                  userHasPaidPlan={userHasPaidPlan}
                  linkLimit={linkLimit}
                  eventUsage={eventUsage}
                  folderUsage={folderUsage}
                  qrCodeUsage={qrCodeUsage}
                  upgradeSignals={upgradeSignals}
                  plan={plan}
                  shown={isDesktop || isMobileMenuOpen}
                />
              </div>
            )}

            {/* Theme Toggle */}
            <div className="px-3 pb-2">
              <ThemeToggle />
            </div>

            {/* Feedback */}
            <div className="space-y-0.5 border-t border-neutral-100 dark:border-border/50 px-3 py-1.5">
              <AudienceFeedbackPrompt
                plan={plan}
                onTriggerClick={() => setIsMobileMenuOpen(false)}
              />
              <button
                onClick={() => {
                  setIsFeedbackOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-900 dark:hover:text-foreground"
              >
                <IconLifebuoy size={18} stroke={1.5} className="shrink-0" />
                Feedback
              </button>
            </div>

            <FeedbackModal open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen} />

            {/* User */}
            <div className="border-t border-neutral-100 dark:border-border/50 p-3">
              <Popover open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
                <PopoverTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.imageUrl} alt={displayName} />
                      <AvatarFallback className="bg-neutral-100 dark:bg-muted text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        {displayName[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-foreground">
                        {displayName}
                      </p>
                      <p className="truncate text-[11px] text-neutral-400 dark:text-muted-foreground">
                        {user?.primaryEmailAddress?.emailAddress}
                      </p>
                    </div>
                    <IconChevronUp
                      size={14}
                      stroke={1.5}
                      className="shrink-0 text-neutral-400 dark:text-muted-foreground"
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1.5" align="start" side="top" sideOffset={8}>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => {
                        router.push("/dashboard/settings");
                        setIsUserMenuOpen(false);
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-900 dark:hover:text-foreground"
                    >
                      <IconUser size={16} stroke={1.5} />
                      Account
                    </button>
                    <button
                      onClick={() => {
                        router.push("/dashboard/settings#billing");
                        setIsUserMenuOpen(false);
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-900 dark:hover:text-foreground"
                    >
                      <IconCreditCard size={16} stroke={1.5} />
                      Billing
                    </button>
                    <div className="my-1 h-px bg-neutral-100 dark:bg-border/50" />
                    <button
                      onClick={() => {
                        void signOut();
                        setIsUserMenuOpen(false);
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <IconLogout size={16} stroke={1.5} />
                      Log out
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
