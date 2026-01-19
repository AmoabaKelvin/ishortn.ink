import { createTRPCRouter, protectedProcedure } from "../../trpc";
import * as inputs from "./account-transfer.input";
import * as services from "./account-transfer.service";

export const accountTransferRouter = createTRPCRouter({
  /**
   * Validate if account transfer is possible (without creating the transfer)
   */
  validate: protectedProcedure
    .input(inputs.initiateTransferSchema)
    .mutation(({ ctx, input }) =>
      services.validateAccountTransfer(ctx, input.targetEmail)
    ),

  /**
   * Initiate account transfer (creates pending transfer and sends email)
   */
  initiate: protectedProcedure
    .input(inputs.initiateTransferSchema)
    .mutation(({ ctx, input }) =>
      services.initiateAccountTransfer(ctx, input)
    ),

  /**
   * Get transfer details by token (for approval page)
   */
  getByToken: protectedProcedure
    .input(inputs.getTransferByTokenSchema)
    .query(({ ctx, input }) =>
      services.getTransferByToken(ctx, input.token)
    ),

  /**
   * Get pending outgoing transfer for current user (if any)
   */
  getPending: protectedProcedure
    .query(({ ctx }) =>
      services.getPendingTransfer(ctx)
    ),

  /**
   * Accept account transfer (executes the transfer)
   */
  accept: protectedProcedure
    .input(inputs.acceptTransferSchema)
    .mutation(({ ctx, input }) =>
      services.acceptAccountTransfer(ctx, input)
    ),

  /**
   * Cancel pending transfer (source user only)
   */
  cancel: protectedProcedure
    .input(inputs.cancelTransferSchema)
    .mutation(({ ctx, input }) =>
      services.cancelAccountTransfer(ctx, input)
    ),
});
