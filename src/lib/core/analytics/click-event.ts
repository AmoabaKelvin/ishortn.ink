import { z } from "zod";

// `id` is stored as LinkVisit.visitId / BioPageView.viewId, so a redelivered
// message cannot insert a second row.

const visitorSchema = z.object({
  ipHash: z.string().length(64),
  device: z.string(),
  browser: z.string(),
  os: z.string(),
  model: z.string(),
  referer: z.string(),
  country: z.string(),
  city: z.string(),
  continent: z.string(),
  occurredAt: z.iso.datetime(),
});

export type Visitor = z.infer<typeof visitorSchema>;

export const clickEventSchema = z.discriminatedUnion("kind", [
  visitorSchema.extend({
    kind: z.literal("link"),
    id: z.uuid(),
    linkId: z.int(),
    ownerId: z.string(),
    matchedGeoRuleId: z.int().nullable(),
  }),
  visitorSchema.extend({
    kind: z.literal("bio"),
    id: z.uuid(),
    bioPageId: z.int(),
    ownerId: z.string(),
  }),
  z.object({
    kind: z.literal("verify"),
    visitId: z.uuid(),
    verifiedAt: z.iso.datetime(),
  }),
]);

export type ClickEvent = z.infer<typeof clickEventSchema>;
export type LinkClickEvent = Extract<ClickEvent, { kind: "link" }>;
export type BioViewEvent = Extract<ClickEvent, { kind: "bio" }>;
export type VerifyEvent = Extract<ClickEvent, { kind: "verify" }>;
