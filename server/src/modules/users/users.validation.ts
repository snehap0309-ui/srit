import { z } from 'zod';

export const updateRoleSchema = z.object({
  permission: z.enum(['USER', 'ADMIN', 'VENDOR', 'CONTENT_CREATOR'], { message: 'Permission must be USER, ADMIN, VENDOR, or CONTENT_CREATOR' }),
  // Set when the admin has already been warned that this grant will retire the user's other professional role.
  confirmSwitch: z.boolean().optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
