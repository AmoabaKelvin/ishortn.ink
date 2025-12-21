"use client";

import { Building2, Check, ChevronsUpDown, Plus, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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

type WorkspaceSwitcherProps = {
  teams: Team[];
  currentWorkspace: CurrentWorkspace;
  canCreateTeam: boolean;
};

export function WorkspaceSwitcher({
  teams,
  currentWorkspace,
  canCreateTeam,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleWorkspaceSwitch = (type: "personal" | "team", teamSlug?: string) => {
    setIsOpen(false);
    const baseDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "ishortn.ink";

    if (type === "personal") {
      // Switch to personal workspace (main domain)
      window.location.href = `${window.location.protocol}//${baseDomain}/dashboard`;
    } else if (teamSlug) {
      // Switch to team workspace (subdomain)
      window.location.href = `${window.location.protocol}//${teamSlug}.${baseDomain}/dashboard`;
    }
  };

  const handleCreateTeam = () => {
    setIsOpen(false);
    router.push("/dashboard/teams/new");
  };

  const isPersonal = currentWorkspace.type === "personal";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-150">
          {isPersonal ? (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <User size={16} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">
                  Personal
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {currentWorkspace.plan} plan
                </p>
              </div>
            </>
          ) : (
            <>
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage
                  src={currentWorkspace.teamAvatar ?? undefined}
                  alt={currentWorkspace.teamName ?? "Team"}
                />
                <AvatarFallback className="rounded-lg bg-purple-100 text-purple-600 font-medium">
                  {currentWorkspace.teamName?.[0]?.toUpperCase() ?? "T"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {currentWorkspace.teamName}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {currentWorkspace.role}
                </p>
              </div>
            </>
          )}
          <ChevronsUpDown size={16} className="text-gray-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-1.5 rounded-xl border-gray-200"
        align="start"
        side="bottom"
        sideOffset={8}
      >
        <div className="space-y-1">
          {/* Personal Workspace */}
          <button
            onClick={() => handleWorkspaceSwitch("personal")}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isPersonal
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
              <User size={14} className="text-blue-600" />
            </div>
            <span className="flex-1 text-left font-medium">Personal</span>
            {isPersonal && <Check size={16} className="text-blue-600" />}
          </button>

          {/* Teams Section */}
          {teams.length > 0 && (
            <>
              <Separator className="my-2" />
              <p className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teams
              </p>
              {teams.map((team) => {
                const isSelected =
                  currentWorkspace.type === "team" &&
                  currentWorkspace.teamId === team.id;

                return (
                  <button
                    key={team.id}
                    onClick={() => handleWorkspaceSwitch("team", team.slug)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isSelected
                        ? "bg-purple-50 text-purple-700"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Avatar className="h-7 w-7 rounded-lg">
                      <AvatarImage
                        src={team.avatarUrl ?? undefined}
                        alt={team.name}
                      />
                      <AvatarFallback className="rounded-lg bg-purple-100 text-purple-600 text-xs font-medium">
                        {team.name[0]?.toUpperCase() ?? "T"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-left font-medium truncate">
                      {team.name}
                    </span>
                    {isSelected && <Check size={16} className="text-purple-600" />}
                  </button>
                );
              })}
            </>
          )}

          {/* Create Team Option */}
          {canCreateTeam && (
            <>
              <Separator className="my-2" />
              <button
                onClick={handleCreateTeam}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-dashed border-gray-300">
                  <Plus size={14} className="text-gray-500" />
                </div>
                <span className="flex-1 text-left font-medium">Create Team</span>
              </button>
            </>
          )}

          {/* Upgrade prompt for non-Ultra users */}
          {!canCreateTeam && teams.length === 0 && (
            <>
              <Separator className="my-2" />
              <div className="px-3 py-2 text-xs text-gray-500">
                <p className="flex items-center gap-2">
                  <Building2 size={14} />
                  <span>Upgrade to Ultra to create teams</span>
                </p>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
