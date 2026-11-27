import {
  createTRPCRouter,
  protectedProcedure,
  teamProcedure,
  workspaceProcedure,
} from "../../trpc";
import * as inputs from "./token.input";
import * as services from "./token.service";

export const tokenRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) => {
    return services.getTokens(ctx);
  }),

  access: protectedProcedure.query(({ ctx }) => {
    return services.getApiAccessStatus(ctx);
  }),

  create: protectedProcedure.input(inputs.createTokenSchema).mutation(({ ctx, input }) => {
    return services.createToken(ctx, input);
  }),

  delete: protectedProcedure.input(inputs.deleteTokenSchema).mutation(({ ctx, input }) => {
    return services.deleteToken(ctx, input);
  }),

  // Team keys act in the current team workspace (see src/app/api/v1/utils.ts).
  // Null in a personal workspace, so the settings page can load it alongside everything else.
  listTeam: workspaceProcedure.query(({ ctx }) => {
    return ctx.workspace.type === "team"
      ? services.getTeamTokens({ ...ctx, workspace: ctx.workspace })
      : null;
  }),

  createTeam: teamProcedure.input(inputs.createTokenSchema).mutation(({ ctx, input }) => {
    return services.createTeamToken(ctx, input);
  }),

  deleteTeam: teamProcedure.input(inputs.deleteTokenSchema).mutation(({ ctx, input }) => {
    return services.deleteTeamToken(ctx, input);
  }),

  listExtensions: protectedProcedure.query(({ ctx }) => {
    return services.getExtensionTokens(ctx);
  }),

  // Called by the /extension/connect server action only: it checks the redirect URI and state.
  connectExtension: protectedProcedure
    .input(inputs.createExtensionTokenSchema)
    .mutation(({ ctx, input }) => {
      return services.createExtensionToken(ctx, input);
    }),

  disconnectExtension: protectedProcedure
    .input(inputs.deleteTokenSchema)
    .mutation(({ ctx, input }) => {
      return services.deleteExtensionToken(ctx, input);
    }),
});
