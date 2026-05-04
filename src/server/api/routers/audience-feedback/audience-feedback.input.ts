import { z } from "zod";

export const audienceFeedbackRoleValues = [
  "founder",
  "marketer",
  "developer",
  "agency",
  "creator",
  "educator",
  "other",
] as const;

export const audienceFeedbackUseCaseValues = [
  "social_media",
  "marketing_campaigns",
  "client_links",
  "product_links",
  "qr_codes",
  "internal_sharing",
  "other",
] as const;

export const audienceFeedbackMonthlyVolumeValues = [
  "1_10",
  "11_50",
  "51_200",
  "201_1000",
  "1000_plus",
] as const;

export const audienceFeedbackAcquisitionChannelValues = [
  "search",
  "social",
  "friend_or_colleague",
  "community",
  "directory",
  "ad",
  "other",
] as const;

export const audienceFeedbackPriorToolValues = [
  "none",
  "bitly",
  "dub",
  "tinyurl",
  "rebrandly",
  "shortio",
  "other",
] as const;

export const audienceFeedbackMagicFeatureValues = [
  "custom_domains",
  "analytics",
  "qr_codes",
  "folders",
  "utm_templates",
  "geo_rules",
  "teams",
  "other",
] as const;

export const audienceFeedbackUpgradeReasonValues = [
  "more_links",
  "more_analytics",
  "custom_domains",
  "teams",
  "geo_rules",
  "qr_codes",
  "support_the_product",
  "other",
] as const;

const optionalFreeText = z.string().trim().max(2000).optional().nullable();

export const submitAudienceFeedbackSchema = z.object({
  role: z.enum(audienceFeedbackRoleValues),
  useCase: z.enum(audienceFeedbackUseCaseValues),
  monthlyVolume: z.enum(audienceFeedbackMonthlyVolumeValues),
  acquisitionChannel: z.enum(audienceFeedbackAcquisitionChannelValues),
  acquisitionDetail: optionalFreeText,
  priorTool: z.enum(audienceFeedbackPriorToolValues),
  switchReason: optionalFreeText,
  magicFeature: z.enum(audienceFeedbackMagicFeatureValues),
  upgradeReason: z.enum(audienceFeedbackUpgradeReasonValues).optional().nullable(),
  upgradeBlocker: optionalFreeText,
  improvementWish: optionalFreeText,
});

export type SubmitAudienceFeedbackInput = z.infer<typeof submitAudienceFeedbackSchema>;
