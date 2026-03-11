"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import {
  IconBan,
  IconChartBar,
  IconChevronUp,
  IconCreditCard,
  IconFlag,
  IconFolder,
  IconLayoutDashboard,
  IconLifebuoy,
  IconLink,
  IconLogout,
  IconMenu2,
  IconMessageReport,
  IconQrcode,
  IconSettings,
  IconShieldLock,
  IconTarget,
  IconUser,
  IconUsers,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { APP_TITLE } from "@/lib/constants/app";
import { cn } from "@/lib/utils";

import { FeedbackModal } from "./feedback-modal";
import { SidebarStats } from "./sidebar-stats";
import { WorkspaceSwitcher } from "./workspace-switcher";

const navigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: IconLayoutDashboard },
  {
    name: "Analytics",
    href: "/dashboard/analytics/overview",
    icon: IconChartBar,
  },
  { name: "QR Codes", href: "/dashboard/qrcodes", icon: IconQrcode },
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
  { name: "Blocked Domains", href: "/dashboard/admin/domains", icon: IconBan },
  { name: "Flagged Links", href: "/dashboard/admin/flagged", icon: IconFlag },
  { name: "Feedback", href: "/dashboard/admin/feedback", icon: IconMessageReport },
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
  eventUsage?: { count: number; limit: number | null } | undefined;
  folderUsage?: { count: number; limit: number | null } | undefined;
  plan?: "free" | "pro" | "ultra";
  teams?: Team[];
  currentWorkspace?: CurrentWorkspace;
  canCreateTeam?: boolean;
  isAdmin?: boolean;
};

export function AppSidebar({
  userHasPaidPlan = false,
  monthlyLinkCount = 0,
  linkLimit = null,
  eventUsage,
  folderUsage,
  plan = "free",
  teams = [],
  currentWorkspace = { type: "personal", plan: "free" },
  canCreateTeam = false,
  isAdmin = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed top-4 left-4 z-50 rounded-lg border border-neutral-200 bg-white p-2 shadow-sm transition-colors hover:bg-neutral-50 lg:hidden"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? (
          <IconX size={20} stroke={1.5} className="text-neutral-700" />
        ) : (
          <IconMenu2 size={20} stroke={1.5} className="text-neutral-700" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-[280px] flex-col border-r border-neutral-200 bg-white transition-transform duration-200 ease-in-out lg:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 shrink-0 items-center px-5">
            <Link
              href="/"
              className="font-logo text-[17px] tracking-tight text-neutral-900"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {APP_TITLE}
            </Link>
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
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href));

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                        isActive
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
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
                <div className="my-3 h-px bg-neutral-100" />
                <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
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
                              ? "bg-neutral-100 text-neutral-900"
                              : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
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
                <div className="my-3 h-px bg-neutral-100" />
                <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                  Admin
                </p>
                <ul className="space-y-0.5">
                  {adminNavigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard/admin" &&
                        pathname.startsWith(item.href));

                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                            isActive
                              ? "bg-neutral-100 text-neutral-900"
                              : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
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
                  plan={plan}
                />
              </div>
            )}

            {/* Feedback */}
            <div className="border-t border-neutral-100 px-3 py-1.5">
              <button
                onClick={() => {
                  setIsFeedbackOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
              >
                <IconLifebuoy size={18} stroke={1.5} className="shrink-0" />
                Feedback
              </button>
            </div>

            <FeedbackModal open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen} />

            {/* User */}
            <div className="border-t border-neutral-100 p-3">
              <Popover open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
                <PopoverTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-neutral-50">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={user?.imageUrl}
                        alt={user?.firstName || "User"}
                      />
                      <AvatarFallback className="bg-neutral-100 text-xs font-medium text-neutral-600">
                        {user?.firstName?.[0] || user?.username?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[13px] font-medium text-neutral-900">
                        {user?.firstName || user?.username || "User"}
                      </p>
                      <p className="truncate text-[11px] text-neutral-400">
                        {user?.primaryEmailAddress?.emailAddress}
                      </p>
                    </div>
                    <IconChevronUp
                      size={14}
                      stroke={1.5}
                      className="shrink-0 text-neutral-400"
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-56 p-1.5"
                  align="start"
                  side="top"
                  sideOffset={8}
                >
                  <div className="space-y-0.5">
                    <button
                      onClick={() => {
                        router.push("/dashboard/settings");
                        setIsUserMenuOpen(false);
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
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
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                    >
                      <IconCreditCard size={16} stroke={1.5} />
                      Billing
                    </button>
                    <div className="my-1 h-px bg-neutral-100" />
                    <button
                      onClick={() => {
                        signOut();
                        setIsUserMenuOpen(false);
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-red-600 transition-colors hover:bg-red-50"
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
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
