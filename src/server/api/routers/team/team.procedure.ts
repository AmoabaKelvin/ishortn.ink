import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  teamProcedure,
  ultraProcedure,
  workspaceProcedure,
} from "../../trpc";
import * as inputs from "./team.input";
import * as services from "./team.service";

export const teamRouter = createTRPCRouter({
  // ============================================================================
  // TEAM CRUD
  // ============================================================================

  /**
   * Create a new team (requires Ultra plan)
   */
  create: ultraProcedure
    .input(inputs.createTeamSchema)
    .mutation(({ ctx, input }) => services.createTeam(ctx, input)),

  /**
   * Get current team details
   */
  get: teamProcedure.query(({ ctx }) => services.getTeam(ctx)),

  /**
   * Update team settings
   */
  update: teamProcedure
    .input(inputs.updateTeamSchema)
    .mutation(({ ctx, input }) => services.updateTeam(ctx, input)),

  /**
   * Update team slug (subdomain)
   */
  updateSlug: teamProcedure
    .input(inputs.updateTeamSlugSchema)
    .mutation(({ ctx, input }) => services.updateTeamSlug(ctx, input)),

  /**
   * Delete team (owner only)
   */
  delete: teamProcedure.mutation(({ ctx }) => services.deleteTeam(ctx)),

  /**
   * List all teams the user is a member of
   */
  list: protectedProcedure.query(({ ctx }) => services.listUserTeams(ctx)),

  /**
   * Check if a team slug is available
   */
  checkSlug: protectedProcedure
    .input(inputs.checkSlugSchema)
    .query(({ ctx, input }) => services.checkSlugAvailability(ctx, input.slug)),

  // ============================================================================
  // TEAM MEMBERS
  // ============================================================================

  /**
   * List all members of the current team
   */
  listMembers: teamProcedure.query(({ ctx }) => services.listMembers(ctx)),

  /**
   * Update a member's role
   */
  updateMemberRole: teamProcedure
    .input(inputs.updateMemberRoleSchema)
    .mutation(({ ctx, input }) => services.updateMemberRole(ctx, input)),

  /**
   * Remove a member from the team
   */
  removeMember: teamProcedure
    .input(inputs.removeMemberSchema)
    .mutation(({ ctx, input }) => services.removeMember(ctx, input)),

  /**
   * Leave the team (for non-owners)
   */
  leave: teamProcedure.mutation(({ ctx }) => services.leaveTeam(ctx)),

  /**
   * Transfer team ownership to another member
   */
  transferOwnership: teamProcedure
    .input(inputs.transferOwnershipSchema)
    .mutation(({ ctx, input }) => services.transferOwnership(ctx, input)),

  // ============================================================================
  // TEAM INVITES
  // ============================================================================

  /**
   * Create an invite to join the team
   */
  createInvite: teamProcedure
    .input(inputs.inviteMemberSchema)
    .mutation(({ ctx, input }) => services.createInvite(ctx, input)),

  /**
   * List pending invites for the team
   */
  listInvites: teamProcedure.query(({ ctx }) => services.listInvites(ctx)),

  /**
   * Revoke a pending invite
   */
  revokeInvite: teamProcedure
    .input(inputs.revokeInviteSchema)
    .mutation(({ ctx, input }) => services.revokeInvite(ctx, input)),

  /**
   * Accept a team invite
   */
  acceptInvite: protectedProcedure
    .input(inputs.acceptInviteSchema)
    .mutation(({ ctx, input }) => services.acceptInvite(ctx, input)),

  /**
   * Get invite details by token (for invite preview page)
   */
  getInviteByToken: protectedProcedure
    .input(z.object({ token: z.string() }))
    .query(({ ctx, input }) => services.getInviteByToken(ctx, input.token)),

  // ============================================================================
  // WORKSPACE INFO
  // ============================================================================

  /**
   * Get current workspace info
   */
  currentWorkspace: workspaceProcedure.query(({ ctx }) =>
    services.getCurrentWorkspace(ctx)
  ),
});
