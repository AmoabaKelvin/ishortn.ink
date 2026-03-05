"use client";

import {
  IconBuilding,
  IconCheck,
  IconPlus,
  IconSelector,
  IconUser,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

  const handleWorkspaceSwitch = (
    type: "personal" | "team",
    teamSlug?: string,
  ) => {
    setIsOpen(false);
    const baseDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "ishortn.ink";

    if (type === "personal") {
      window.location.href = `${window.location.protocol}//${baseDomain}/dashboard`;
    } else if (teamSlug) {
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
        <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-neutral-50">
          {isPersonal ? (
            <>
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100">
                <IconUser
                  size={14}
                  stroke={1.5}
                  className="text-neutral-600"
                />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-medium text-neutral-900">
                  Personal
                </p>
                <p className="text-[11px] capitalize text-neutral-400">
                  {currentWorkspace.plan} plan
                </p>
              </div>
            </>
          ) : (
            <>
              <Avatar className="h-7 w-7 rounded-md">
                <AvatarImage
                  src={currentWorkspace.teamAvatar ?? undefined}
                  alt={currentWorkspace.teamName ?? "Team"}
                />
                <AvatarFallback className="rounded-md bg-neutral-100 text-xs font-medium text-neutral-600">
                  {currentWorkspace.teamName?.[0]?.toUpperCase() ?? "T"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-medium text-neutral-900">
                  {currentWorkspace.teamName}
                </p>
                <p className="text-[11px] capitalize text-neutral-400">
                  {currentWorkspace.role}
                </p>
              </div>
            </>
          )}
          <IconSelector
            size={14}
            stroke={1.5}
            className="shrink-0 text-neutral-400"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-60 p-1.5"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <div className="space-y-0.5">
          {/* Personal Workspace */}
          <button
            onClick={() => handleWorkspaceSwitch("personal")}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
              isPersonal
                ? "bg-neutral-100 text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
            )}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-200/60">
              <IconUser size={13} stroke={1.5} className="text-neutral-600" />
            </div>
            <span className="flex-1 text-left font-medium">Personal</span>
            {isPersonal && (
              <IconCheck
                size={14}
                stroke={2}
                className="text-neutral-900"
              />
            )}
          </button>

          {/* Teams */}
          {teams.length > 0 && (
            <>
              <div className="my-1.5 h-px bg-neutral-100" />
              <p className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
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
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                      isSelected
                        ? "bg-neutral-100 text-neutral-900"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
                    )}
                  >
                    <Avatar className="h-6 w-6 rounded-md">
                      <AvatarImage
                        src={team.avatarUrl ?? undefined}
                        alt={team.name}
                      />
                      <AvatarFallback className="rounded-md bg-neutral-200/60 text-[10px] font-medium text-neutral-600">
                        {team.name[0]?.toUpperCase() ?? "T"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-left font-medium">
                      {team.name}
                    </span>
                    {isSelected && (
                      <IconCheck
                        size={14}
                        stroke={2}
                        className="text-neutral-900"
                      />
                    )}
                  </button>
                );
              })}
            </>
          )}

          {/* Create Team */}
          {canCreateTeam && (
            <>
              <div className="my-1.5 h-px bg-neutral-100" />
              <button
                onClick={handleCreateTeam}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-neutral-300">
                  <IconPlus
                    size={12}
                    stroke={1.5}
                    className="text-neutral-500"
                  />
                </div>
                <span className="flex-1 text-left font-medium">
                  Create Team
                </span>
              </button>
            </>
          )}

          {/* Upgrade prompt */}
          {!canCreateTeam && teams.length === 0 && (
            <>
              <div className="my-1.5 h-px bg-neutral-100" />
              <div className="flex items-center gap-2 px-2.5 py-2 text-[11px] text-neutral-400">
                <IconBuilding size={13} stroke={1.5} />
                <span>Upgrade to Ultra to create teams</span>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
