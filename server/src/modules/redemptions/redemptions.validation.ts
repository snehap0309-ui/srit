import { z } from 'zod';

export const generateRedemptionSchema = z.object({
  offerId: z.string().min(1),
});

export const verifyRedemptionSchema = z.object({
  token: z.string().min(1, 'Redemption token is required'),
});

export const adminRefundSchema = z.object({
  notes: z.string().optional(),
});

export const adminListSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['PENDING', 'VERIFIED', 'CANCELLED']).optional(),
  userId: z.string().optional(),
  vendorId: z.string().optional(),
  offerId: z.string().optional(),
});

export const payPointsSchema = z.object({
  vendorCode: z.string().min(1, 'Vendor code is required'),
  points: z.number().int().positive('Points must be a positive number'),
});

export type GenerateRedemptionInput = z.infer<typeof generateRedemptionSchema>;
export type VerifyRedemptionInput = z.infer<typeof verifyRedemptionSchema>;
export type PayPointsInput = z.infer<typeof payPointsSchema>;
export type AdminRefundInput = z.infer<typeof adminRefundSchema>;
export type AdminListInput = z.infer<typeof adminListSchema>;
