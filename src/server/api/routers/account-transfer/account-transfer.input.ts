import { z } from "zod";

export const initiateTransferSchema = z.object({
  targetEmail: z.string().email("Please enter a valid email address"),
});

export const getTransferByTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export const acceptTransferSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export const cancelTransferSchema = z.object({
  transferId: z.number().int().positive(),
});

export type InitiateTransferInput = z.infer<typeof initiateTransferSchema>;
export type GetTransferByTokenInput = z.infer<typeof getTransferByTokenSchema>;
export type AcceptTransferInput = z.infer<typeof acceptTransferSchema>;
export type CancelTransferInput = z.infer<typeof cancelTransferSchema>;
