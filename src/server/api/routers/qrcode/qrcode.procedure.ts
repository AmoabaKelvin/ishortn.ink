import { createTRPCRouter, workspaceProcedure } from "../../trpc";
import * as inputs from "./qrcode.input";
import * as services from "./qrcode.service";

export const qrCodeRouter = createTRPCRouter({
  create: workspaceProcedure.input(inputs.qrcodeInput).mutation(async ({ ctx, input }) => {
    return services.createQrCode(ctx, input);
  }),
  list: workspaceProcedure.query(async ({ ctx }) => {
    return services.retrieveUserQrCodes(ctx);
  }),
  delete: workspaceProcedure.input(inputs.qrcodeDeleteInput).mutation(async ({ ctx, input }) => {
    return services.deleteQrCode(ctx, input.id);
  }),

  // QR Preset procedures
  createPreset: workspaceProcedure.input(inputs.qrPresetCreateInput).mutation(async ({ ctx, input }) => {
    return services.createQrPreset(ctx, input);
  }),
  listPresets: workspaceProcedure.query(async ({ ctx }) => {
    return services.listQrPresets(ctx);
  }),
  updatePreset: workspaceProcedure.input(inputs.qrPresetUpdateInput).mutation(async ({ ctx, input }) => {
    return services.updateQrPreset(ctx, input);
  }),
  deletePreset: workspaceProcedure.input(inputs.qrPresetDeleteInput).mutation(async ({ ctx, input }) => {
    return services.deleteQrPreset(ctx, input.id);
  }),
});
