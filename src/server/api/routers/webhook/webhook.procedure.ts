import { contentWriteProcedure, createTRPCRouter, workspaceProcedure } from "../../trpc";
import { createWebhookInput, updateWebhookInput, webhookIdInput } from "./webhook.input";
import {
  createWebhook,
  deleteWebhook,
  listWebhookDeliveries,
  listWebhooks,
  rollWebhookSecret,
  sendTestWebhook,
  updateWebhook,
} from "./webhook.service";

export const webhookRouter = createTRPCRouter({
  list: workspaceProcedure.query(({ ctx }) => listWebhooks(ctx)),

  // Writes go through contentWriteProcedure: a restricted account may not aim requests anywhere.
  create: contentWriteProcedure
    .input(createWebhookInput)
    .mutation(({ ctx, input }) => createWebhook(ctx, input)),

  update: contentWriteProcedure
    .input(updateWebhookInput)
    .mutation(({ ctx, input }) => updateWebhook(ctx, input)),

  delete: workspaceProcedure
    .input(webhookIdInput)
    .mutation(({ ctx, input }) => deleteWebhook(ctx, input)),

  rollSecret: contentWriteProcedure
    .input(webhookIdInput)
    .mutation(({ ctx, input }) => rollWebhookSecret(ctx, input)),

  sendTest: contentWriteProcedure
    .input(webhookIdInput)
    .mutation(({ ctx, input }) => sendTestWebhook(ctx, input)),

  deliveries: workspaceProcedure
    .input(webhookIdInput)
    .query(({ ctx, input }) => listWebhookDeliveries(ctx, input)),
});
