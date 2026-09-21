import { createTRPCRouter, softDeletedProcedure } from "../../trpc";
import * as inputs from "./account-deletion.input";
import * as services from "./account-deletion.service";

// softDeletedProcedure: a deleted user still needs status and restore.
export const accountDeletionRouter = createTRPCRouter({
  status: softDeletedProcedure.query(({ ctx }) => services.getDeletionStatus(ctx)),

  request: softDeletedProcedure
    .input(inputs.requestAccountDeletionSchema)
    .mutation(({ ctx, input }) => services.requestAccountDeletion(ctx, input)),

  restore: softDeletedProcedure.mutation(({ ctx }) => services.restoreAccount(ctx)),
});
