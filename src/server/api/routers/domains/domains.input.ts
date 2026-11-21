import { z } from "zod";

import { HOSTNAME_PATTERN, normalizeDomainInput } from "./utils";

export const createCustomDomainSchema = z.object({
  domain: z
    .string()
    .max(255, "Domain name is too long")
    .transform(normalizeDomainInput)
    .pipe(
      z
        .string()
        .min(1, "Domain is required")
        .regex(HOSTNAME_PATTERN, "Enter a domain like links.example.com, without a path or port"),
    ),
});

// Zod schema for the custom domain object
export const customDomainSchema = z.object({
  id: z.number(),
  domain: z.string(),
  userId: z.string(),
  createdAt: z.date(),
  verifiedAt: z.date().nullable(),
  status: z.enum(["pending", "active", "invalid"]),
});

// Zod schema for deleting a custom domain
export const deleteCustomDomainSchema = z.object({
  id: z.number(),
});

// Zod schema for listing custom domains (response)
export const listCustomDomainsSchema = z.array(customDomainSchema);

// Inferred TypeScript types
export type CreateCustomDomainInput = z.infer<typeof createCustomDomainSchema>;
export type CustomDomain = z.infer<typeof customDomainSchema>;
export type DeleteCustomDomainInput = z.infer<typeof deleteCustomDomainSchema>;
export type ListCustomDomainsResponse = z.infer<typeof listCustomDomainsSchema>;

// Additional utility types
export type CustomDomainStatus = CustomDomain["status"];
