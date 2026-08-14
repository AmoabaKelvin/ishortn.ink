import { and, count, eq } from "drizzle-orm";
import { z } from "zod";

import { getPlanCaps, isUnlimitedDomains, resolvePlan } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";
import { createTRPCRouter, workspaceProcedure } from "@/server/api/trpc";
import { customDomain } from "@/server/db/schema";
import { workspaceFilter } from "@/server/lib/workspace";

import {
  buildVerificationChallenges,
  getCustomHostname,
  mapStatus,
  wwwFallbackActive,
} from "./cloudflare";
import * as input from "./domains.input";
import * as services from "./domains.service";
import { isDomainActiveOnVercel } from "./vercel-legacy";

import type { CloudflareCustomHostname } from "./cloudflare";

const log = logger.child({ component: "domains.procedure" });

function toMigrationRecords(domain: string, hostname?: CloudflareCustomHostname | null) {
  return buildVerificationChallenges(domain, hostname).map((challenge) => ({
    type: challenge.type,
    name: challenge.domain,
    value: challenge.value,
  }));
}

export const customDomainRouter = createTRPCRouter({
  create: workspaceProcedure
    .input(input.createCustomDomainSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.user.findFirst({
        where: (table, { eq }) => eq(table.id, ctx.auth.userId),
        with: { subscriptions: true },
      });

      const plan = resolvePlan(user?.subscriptions);

      if (!isUnlimitedDomains(plan)) {
        const caps = getPlanCaps(plan);
        const domainCount = await ctx.db
          .select({ count: count() })
          .from(customDomain)
          .where(workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId))
          .then((res) => res[0]?.count ?? 0);

        if (domainCount >= (caps.domainLimit ?? 0)) {
          throw new Error(
            `You have reached the limit of ${caps.domainLimit} custom domains for your plan. Please upgrade to add more.`,
          );
        }
      }

      return services.addDomainToUserAccount(ctx, input);
    }),

  list: workspaceProcedure.query(async ({ ctx }) => {
    return services.getCustomDomainsForUser(ctx);
  }),

  delete: workspaceProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return services.deleteDomainAndAssociatedLinks(ctx, input.id);
    }),

  getStats: workspaceProcedure
    .input(z.object({ domain: z.string() }))
    .query(async ({ ctx, input }) => {
      return services.getDomainStatistics(ctx, input.domain);
    }),

  migrationStatus: workspaceProcedure.query(async ({ ctx }) => {
    const domains = await services.getCustomDomainsForUser(ctx);

    return Promise.all(
      domains
        .filter((record) => record.domain)
        .map(async (record) => {
          const domain = record.domain!;

          try {
            const hostname = await getCustomHostname(domain);
            const cloudflareActive =
              (hostname !== null && mapStatus(hostname) === "active") ||
              (await wwwFallbackActive(domain));

            return {
              domain,
              cloudflareActive,
              fetchError: false,
              records: cloudflareActive ? [] : toMigrationRecords(domain, hostname),
            };
          } catch (error) {
            log.warn({ err: error, domain }, "migration status check failed");

            return {
              domain,
              cloudflareActive: false,
              fetchError: true,
              records: toMigrationRecords(domain),
            };
          }
        }),
    );
  }),

  checkStatus: workspaceProcedure
    .input(z.object({ domain: z.string() }))
    .query(async ({ ctx, input }) => {
      const domain = input.domain;
      log.debug({ domain }, "checking domain status");

      const hostname = await getCustomHostname(domain);

      log.debug(
        {
          domain,
          hostnameStatus: hostname?.status ?? "not_found",
          sslStatus: hostname?.ssl?.status ?? "not_found",
        },
        "Cloudflare custom hostname state",
      );

      if ((hostname && mapStatus(hostname) === "active") || (await wwwFallbackActive(domain))) {
        await ctx.db
          .update(customDomain)
          .set({ status: "active" })
          .where(
            and(
              eq(customDomain.domain, domain),
              workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId),
            ),
          );

        return {
          status: "active",
        };
      }

      // Dual-run fallback: domains still configured against Vercel stay active
      if (await isDomainActiveOnVercel(domain)) {
        log.debug({ domain }, "domain active via legacy Vercel configuration");

        await ctx.db
          .update(customDomain)
          .set({ status: "active" })
          .where(
            and(
              eq(customDomain.domain, domain),
              workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId),
            ),
          );

        return {
          status: "active",
          legacyVercel: true,
        };
      }

      const verificationChallenges = buildVerificationChallenges(domain, hostname);

      // Refresh stored challenges so the dashboard and reminder emails show the
      // current Cloudflare records instead of stale Vercel-era ones
      await ctx.db
        .update(customDomain)
        .set({ verificationDetails: JSON.stringify(verificationChallenges) })
        .where(
          and(
            eq(customDomain.domain, domain),
            workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId),
          ),
        );

      return {
        status: "pending",
        verificationChallenges,
      };
    }),
});
