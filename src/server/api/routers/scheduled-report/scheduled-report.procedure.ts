import { contentWriteProcedure, createTRPCRouter, workspaceProcedure } from "../../trpc";
import {
  createScheduledReportInput,
  deleteScheduledReportInput,
  listScheduledReportsInput,
  updateScheduledReportInput,
} from "./scheduled-report.input";
import {
  createScheduledReport,
  deleteScheduledReport,
  listScheduledReports,
  updateScheduledReport,
} from "./scheduled-report.service";

export const scheduledReportRouter = createTRPCRouter({
  list: workspaceProcedure.input(listScheduledReportsInput).query(async ({ ctx, input }) => {
    return listScheduledReports(ctx, input);
  }),

  // Reports email addresses outside the account, so restricted accounts can't add or change them.
  create: contentWriteProcedure
    .input(createScheduledReportInput)
    .mutation(async ({ ctx, input }) => {
      return createScheduledReport(ctx, input);
    }),

  update: contentWriteProcedure
    .input(updateScheduledReportInput)
    .mutation(async ({ ctx, input }) => {
      return updateScheduledReport(ctx, input);
    }),

  delete: workspaceProcedure.input(deleteScheduledReportInput).mutation(async ({ ctx, input }) => {
    return deleteScheduledReport(ctx, input);
  }),
});
