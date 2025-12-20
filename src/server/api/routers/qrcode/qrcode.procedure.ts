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
});
