import { z } from 'zod';

export const generateReportQuerySchema = z.object({
  type: z.enum(['users', 'vendors', 'places', 'revenue', 'engagement']).optional().default('users'),
  format: z.enum(['json', 'csv']).optional().default('json'),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  city: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
});

export type GenerateReportQuery = z.infer<typeof generateReportQuerySchema>;
