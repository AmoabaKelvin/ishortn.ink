import { createTRPCRouter, softDeletedProcedure } from "../../trpc";
import * as inputs from "./account-deletion.input";
import * as services from "./account-deletion.service";

// Every procedure here uses softDeletedProcedure: a user who already requested
// deletion still has to be able to read their status and restore the account.
export const accountDeletionRouter = createTRPCRouter({
  status: softDeletedProcedure.query(({ ctx }) => services.getDeletionStatus(ctx)),

  request: softDeletedProcedure
    .input(inputs.requestAccountDeletionSchema)
    .mutation(({ ctx, input }) => services.requestAccountDeletion(ctx, input)),

  restore: softDeletedProcedure.mutation(({ ctx }) => services.restoreAccount(ctx)),
});
