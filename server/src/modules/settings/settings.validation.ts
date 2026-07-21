import { z } from 'zod';

export const updateSettingSchema = z.object({
  value: z.any(),
});

export const bulkUpdateSettingsSchema = z.object({
  updates: z.array(z.object({
    key: z.string().min(1).max(100),
    value: z.any(),
  })).min(1).max(100),
});

export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
export type BulkUpdateSettingsInput = z.infer<typeof bulkUpdateSettingsSchema>;
