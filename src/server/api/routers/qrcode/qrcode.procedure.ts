import { createTRPCRouter, contentWriteProcedure, workspaceProcedure } from "../../trpc";
import * as inputs from "./qrcode.input";
import * as services from "./qrcode.service";

export const qrCodeRouter = createTRPCRouter({
  create: contentWriteProcedure.input(inputs.qrcodeInput).mutation(async ({ ctx, input }) => {
    return services.createQrCode(ctx, input);
  }),
  createStatic: contentWriteProcedure
    .input(inputs.qrcodeStaticInput)
    .mutation(async ({ ctx, input }) => {
      return services.createStaticQrCode(ctx, input);
    }),
  updateStatic: contentWriteProcedure
    .input(inputs.qrcodeStaticUpdateInput)
    .mutation(async ({ ctx, input }) => {
      return services.updateStaticQrCode(ctx, input);
    }),
  get: workspaceProcedure.input(inputs.qrcodeIdInput).query(async ({ ctx, input }) => {
    return services.getQrCode(ctx, input.id);
  }),
  list: workspaceProcedure.query(async ({ ctx }) => {
    return services.retrieveUserQrCodes(ctx);
  }),
  delete: workspaceProcedure.input(inputs.qrcodeIdInput).mutation(async ({ ctx, input }) => {
    return services.deleteQrCode(ctx, input.id);
  }),
  saveImage: contentWriteProcedure
    .input(inputs.qrcodeSaveImageInput)
    .mutation(async ({ ctx, input }) => {
      return services.saveQrCodeImage(ctx, input);
    }),

  update: contentWriteProcedure.input(inputs.qrcodeUpdateInput).mutation(async ({ ctx, input }) => {
    return services.updateQrCode(ctx, input);
  }),
  resetStatistics: workspaceProcedure
    .input(inputs.qrcodeIdInput)
    .mutation(async ({ ctx, input }) => {
      return services.resetQrCodeStatistics(ctx, input.id);
    }),
  toggleStatus: contentWriteProcedure
    .input(inputs.qrcodeIdInput)
    .mutation(async ({ ctx, input }) => {
      return services.toggleQrCodeStatus(ctx, input.id);
    }),

  // QR Preset procedures
  createPreset: workspaceProcedure
    .input(inputs.qrPresetCreateInput)
    .mutation(async ({ ctx, input }) => {
      return services.createQrPreset(ctx, input);
    }),
  listPresets: workspaceProcedure.query(async ({ ctx }) => {
    return services.listQrPresets(ctx);
  }),
  updatePreset: workspaceProcedure
    .input(inputs.qrPresetUpdateInput)
    .mutation(async ({ ctx, input }) => {
      return services.updateQrPreset(ctx, input);
    }),
  deletePreset: workspaceProcedure
    .input(inputs.qrPresetDeleteInput)
    .mutation(async ({ ctx, input }) => {
      return services.deleteQrPreset(ctx, input.id);
    }),
});
