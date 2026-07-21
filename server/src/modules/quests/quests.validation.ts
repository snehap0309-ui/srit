import { z } from 'zod';

export const createQuestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  type: z.enum(['scavenger_hunt', 'quiz', 'photo_challenge']).optional(),
  rewardPoints: z.number().int().min(0).optional(),
  placeIds: z.array(z.string()).optional(),
  image: z.string().optional(),
  startsAt: z.string().min(1, 'Start date is required'),
  endsAt: z.string().optional(),
});

export const updateQuestSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['scavenger_hunt', 'quiz', 'photo_challenge']).optional(),
  rewardPoints: z.number().int().min(0).optional(),
  placeIds: z.array(z.string()).optional(),
  image: z.string().nullable().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const listQuestsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  isActive: z.string().optional(),
  search: z.string().optional(),
});
