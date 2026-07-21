import { z } from 'zod';

export const growthAnalyticsDashboardQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export type GrowthAnalyticsDashboardQuery = z.infer<typeof growthAnalyticsDashboardQuerySchema>;
