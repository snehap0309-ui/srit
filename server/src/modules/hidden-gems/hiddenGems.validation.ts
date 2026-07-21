import { z } from 'zod';

export const createHiddenGemSchema = z.object({
  placeName: z.string().min(1).max(200),
  category: z.string().min(1),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  imageUri: z.string().url().optional(),
  description: z.string().min(10).max(2000),
  bestTimeToVisit: z.union([
    z.string().max(100),
    z.object({
      from: z.string().min(1),
      to: z.string().min(1),
      label: z.string().optional(),
    }),
  ]).optional(),
  estimatedCost: z.string().max(100).optional(),
  safetyTip: z.string().max(500).optional(),
  worthVisitingReason: z.string().min(10).max(1000),
  locationMethod: z.enum(['gps', 'map_pick', 'manual']),
});

export const approveHiddenGemSchema = z.object({
  points: z.number().int().min(0).max(500).optional(),
});

export const rejectHiddenGemSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const listHiddenGemsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export type CreateHiddenGemInput = z.infer<typeof createHiddenGemSchema>;
export type ApproveHiddenGemInput = z.infer<typeof approveHiddenGemSchema>;
export type RejectHiddenGemInput = z.infer<typeof rejectHiddenGemSchema>;