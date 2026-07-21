import { z } from 'zod';

export const revenueAnalyticsDashboardQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  city: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
});

export const revenueExportQuerySchema = z.object({
  type: z.enum(['redemptions', 'vendors', 'offers']).optional().default('redemptions'),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export type RevenueAnalyticsDashboardQuery = z.infer<typeof revenueAnalyticsDashboardQuerySchema>;
export type RevenueExportQuery = z.infer<typeof revenueExportQuerySchema>;
