import { z } from 'zod';

export const cityAnalyticsDashboardQuerySchema = z.object({
  state: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export type CityAnalyticsDashboardQuery = z.infer<typeof cityAnalyticsDashboardQuerySchema>;
