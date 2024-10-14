import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { customDomain } from "@/server/db/schema";

import * as input from "./domains.input";
import * as services from "./domains.service";

export const customDomainRouter = createTRPCRouter({
  create: protectedProcedure
    .input(input.createCustomDomainSchema)
    .mutation(async ({ ctx, input }) => {
      return services.addDomainToUserAccount(ctx, input);
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return services.getCustomDomainsForUser(ctx);
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return services.deleteDomainAndAssociatedLinks(ctx, input.id);
    }),

  checkStatus: protectedProcedure
    .input(z.object({ domain: z.string() }))
    .query(async ({ ctx, input }) => {
      console.log("Domain we are checking for", input.domain);

      const domain = input.domain;

      const [configResponse, domainResponse] = await Promise.all([
        fetch(
          `https://api.vercel.com/v6/domains/${domain}/config?teamId=${process.env.TEAM_ID_VERCEL}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
              "Content-Type": "application/json",
            },
          },
        ),
        fetch(
          `https://api.vercel.com/v9/projects/${process.env.PROJECT_ID_VERCEL}/domains/${domain}?teamId=${process.env.TEAM_ID_VERCEL}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
              "Content-Type": "application/json",
            },
          },
        ),
      ]);

      const configData = (await configResponse.json()) as VercelConfigResponse;
      const domainData = (await domainResponse.json()) as VercelDomainResponse;

      console.log("Config data", configData);
      console.log("Domain data", domainData);

      if (configData.misconfigured && domainData.verified) {
        const isApex = domainData.name.split(".").length === 2;
        const verificationRecord = configData.misconfigured
          ? null
          : (configData.challenges?.find((c) => c.type === "TXT")?.value ?? null);

        let status: "pending" | "active" | "invalid" = "pending";
        const verificationDetails: VerificationDetails = {
          challenges: [],
        };

        // Add TXT challenge if available
        if (verificationRecord) {
          verificationDetails.challenges.push({
            type: "TXT",
            domain: "_vercel",
            value: verificationRecord,
          });
        }

        // Add A or CNAME challenge based on domain type
        if (isApex) {
          verificationDetails.challenges.push({
            type: "A",
            domain: "@",
            value: "76.76.21.21",
          });
        } else {
          const subdomain = domain.split(".")[0];
          verificationDetails.challenges.push({
            type: "CNAME",
            domain: subdomain!,
            value: "cname.vercel-dns.com",
          });
        }

        if (domainData.verified) {
          status = configData.misconfigured ? "invalid" : "active";
        }

        // Update the database with the new status and verification details

        console.log("Status", status);
        console.log("Verification details", verificationDetails);

        if (domainData.verified) {
          await ctx.db
            .update(customDomain)
            .set({
              status,
              verificationDetails: JSON.stringify(verificationDetails.challenges),
            })
            .where(and(eq(customDomain.domain, domain), eq(customDomain.userId, ctx.auth.userId)));
        }

        return {
          status,
          verificationChallenges: verificationDetails.challenges,
        };
      }

      if (configData.misconfigured === false) {
        // everything is all clear
        await ctx.db
          .update(customDomain)
          .set({ status: "active" })
          .where(and(eq(customDomain.domain, domain), eq(customDomain.userId, ctx.auth.userId)));

        return {
          status: "active",
        };
      }

      return {
        status: "invalid",
      };
    }),
});

export type VercelConfigResponse = {
  configuredBy: string | null;
  nameservers: string[];
  serviceType: string;
  cnames: string[];
  aValues: string[];
  conflicts: unknown[];
  acceptedChallenges: unknown[];
  misconfigured: boolean;
  challenges?: { type: string; value: string }[];
};

type VercelDomainResponse = {
  name: string;
  apexName: string;
  projectId: string;
  redirect: string | null;
  redirectStatusCode: number | null;
  gitBranch: string | null;
  customEnvironmentId: string | null;
  updatedAt: number;
  createdAt: number;
  verified: boolean;
};

type Challenge = {
  type: "TXT" | "A" | "CNAME";
  domain: string;
  value: string;
};

type VerificationDetails = {
  challenges: Challenge[];
};
