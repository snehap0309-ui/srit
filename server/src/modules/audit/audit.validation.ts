import { z } from 'zod';

export const auditListQuerySchema = z.object({
  page: z.string().optional().default('1').refine((v) => !isNaN(parseInt(v)) && parseInt(v) > 0, { message: 'Page must be a positive integer' }),
  limit: z.string().optional().default('20').refine((v) => !isNaN(parseInt(v)) && parseInt(v) > 0 && parseInt(v) <= 100, { message: 'Limit must be between 1 and 100' }),
  entityType: z.string().max(100).optional(),
  entityId: z.string().uuid().optional(),
  action: z.string().max(50).optional(),
});

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
