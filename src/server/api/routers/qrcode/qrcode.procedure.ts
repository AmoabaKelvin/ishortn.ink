import { createTRPCRouter, protectedProcedure } from "../../trpc";
import * as inputs from "./qrcode.input";
import * as services from "./qrcode.service";

export const qrCodeRouter = createTRPCRouter({
  create: protectedProcedure.input(inputs.qrcodeInput).mutation(async ({ ctx, input }) => {
    return services.createQrCode(ctx, input);
  }),
  list: protectedProcedure.query(async ({ ctx }) => {
    return services.retrieveUserQrCodes(ctx);
  }),
  delete: protectedProcedure.input(inputs.qrcodeDeleteInput).mutation(async ({ ctx, input }) => {
    return services.deleteQrCode(ctx, input.id);
  }),
});
