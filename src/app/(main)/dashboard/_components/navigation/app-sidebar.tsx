"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import {
  Bell,
  ChartArea,
  ChevronUp,
  Cog,
  CreditCard,
  FolderOpen,
  Globe,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanQrCode,
  Target,
  User,
  Users,
  X,
} from "lucide-react";
import { Link } from "next-view-transitions";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { SidebarStats } from "./sidebar-stats";
import { WorkspaceSwitcher } from "./workspace-switcher";

const navigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Analytics", href: "/dashboard/analytics/overview", icon: ChartArea },
  { name: "QR Codes", href: "/dashboard/qrcodes", icon: ScanQrCode },
  { name: "Domains", href: "/dashboard/domains", icon: Globe },
  { name: "Folders", href: "/dashboard/folders", icon: FolderOpen },
  { name: "UTM Templates", href: "/dashboard/utm-templates", icon: Target },
  { name: "Settings", href: "/dashboard/settings", icon: Cog },
];

// Additional navigation items for team workspaces
const teamNavigationItems = [
  { name: "Team Members", href: "/dashboard/teams/members", icon: Users },
  { name: "Team Settings", href: "/dashboard/teams/settings", icon: Cog },
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
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();

  // const {
  //   register,
  //   handleSubmit,
  //   reset,
  //   formState: { errors },
  // } = useForm<QuickLinkShorteningInput>();

  // const quickLinkShorteningMutation = api.link.quickShorten.useMutation({
  //   onSuccess() {
  //     toast.success("Link shortened successfully");
  //     reset({ url: "" });
  //     revalidateHomepage();
  //   },
  //   onError(error) {
  //     toast.error(error.message);
  //   },
  // });

  // const onSubmit = async (data: QuickLinkShorteningInput) => {
  //   quickLinkShorteningMutation.mutate({
  //     ...data,
  //     tags: [],
  //   });
  //   await revalidateHomepage();
  // };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md lg:hidden hover:bg-gray-50 transition-colors"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? (
          <X size={24} className="text-gray-700" />
        ) : (
          <Menu size={24} className="text-gray-700" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-[280px] flex-col border-r border-gray-200 bg-white transition-transform duration-200 ease-in-out lg:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center border-b border-gray-100 px-6">
            <Link
              href="/"
              className="text-xl font-bold text-gray-900"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              iShortn.ink
            </Link>
          </div>

          {/* Workspace Switcher */}
          <div className="border-b border-gray-100 p-4">
            <WorkspaceSwitcher
              teams={teams}
              currentWorkspace={currentWorkspace}
              canCreateTeam={canCreateTeam}
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Quick Shorten Form */}
            {/* <div className="border-b border-gray-100 p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Quick Shorten
              </h3>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                <Input
                  type="url"
                  placeholder="Paste your long URL..."
                  className={cn(
                    "h-10 text-sm border-gray-200 focus-visible:ring-blue-500",
                    errors.url && "border-red-400 focus-visible:ring-red-500"
                  )}
                  {...register("url", { required: true })}
                />
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-10 shadow-sm"
                  disabled={quickLinkShorteningMutation.isLoading}
                >
                  {quickLinkShorteningMutation.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Shortening...
                    </>
                  ) : (
                    "Shorten Link"
                  )}
                </Button>
              </form>
            </div> */}

            {/* Navigation */}
            <nav className="p-4">
              <ul className="space-y-1">
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
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                          isActive
                            ? "bg-blue-50 text-blue-600"
                            : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
                        )}
                      >
                        <Icon size={20} className="shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Team Navigation (only shown in team workspaces) */}
              {currentWorkspace.type === "team" && (
                <>
                  <div className="my-4 border-t border-gray-100" />
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Team
                  </p>
                  <ul className="space-y-1">
                    {teamNavigationItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname.startsWith(item.href);

                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                              isActive
                                ? "bg-purple-50 text-purple-600"
                                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
                            )}
                          >
                            <Icon size={20} className="shrink-0" />
                            <span>{item.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </nav>
          </div>

          {/* Footer Section */}
          <div className="shrink-0 border-t border-gray-100">
            {/* Stats Section - Only show for personal workspace */}
            {currentWorkspace.type === "personal" && (
              <div className="pt-3">
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

            {/* Settings & Help Links */}
            <div className="p-3 space-y-1">
              {/* <Link
                href="/dashboard/settings"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all duration-150"
              >
                <Cog size={18} className="shrink-0" />
                <span>Settings</span>
              </Link> */}
              <Link
                href="https://docs.google.com/forms/d/e/1FAIpQLSfVfz9c1qkC4aDSjFnMcVnrimKiNOHA2aoQhyxNaMmDjMSNEg/viewform?usp=sf_link"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all duration-150"
              >
                <HelpCircle size={18} className="shrink-0" />
                <span>Get Help</span>
              </Link>
            </div>

            <Separator className="bg-gray-100" />

            {/* User Menu */}
            <div className="p-3">
              <Popover open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
                <PopoverTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition-all duration-150">
                    <Avatar className="h-9 w-9">
                      <AvatarImage
                        src={user?.imageUrl}
                        alt={user?.firstName || "User"}
                      />
                      <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
                        {user?.firstName?.[0] || user?.username?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user?.firstName || user?.username || "User"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user?.primaryEmailAddress?.emailAddress}
                      </p>
                    </div>
                    <ChevronUp size={16} className="text-gray-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-64 p-2"
                  align="end"
                  side="top"
                  sideOffset={8}
                >
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        router.push("/dashboard/settings");
                        setIsUserMenuOpen(false);
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <User size={16} />
                      <span>Account</span>
                    </button>
                    <button
                      onClick={() => {
                        router.push("/dashboard/settings#billing");
                        setIsUserMenuOpen(false);
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <CreditCard size={16} />
                      <span>Billing</span>
                    </button>
                    <button
                      onClick={() => {
                        // Add notifications handler when ready
                        setIsUserMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Bell size={16} />
                      <span>Notifications</span>
                    </button>
                    <Separator className="my-2" />
                    <button
                      onClick={() => {
                        signOut();
                        setIsUserMenuOpen(false);
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={16} />
                      <span>Log out</span>
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
          className="fixed inset-0 z-30 bg-black/20 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
