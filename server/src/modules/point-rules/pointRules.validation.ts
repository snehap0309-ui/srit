import { z } from 'zod';

export const createRuleSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  points: z.number().int().min(0),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
  cooldownSec: z.number().int().positive().optional(),
  maxDaily: z.number().int().positive().optional(),
});

export const updateRuleSchema = createRuleSchema.partial();

/**
 * Only rules that map to real wallet awards in server code.
 * Wishlist / unimplemented actions must NOT appear here.
 *
 * Event attendance & hosting: NOT implemented — no PlaceEvent check-in or host reward path.
 * Challenges award points via difficulty/milestones (not a single PointRule key).
 */
export const DEFAULT_POINT_RULES = [
  {
    key: 'place_visit',
    label: 'Place Visit',
    description: 'Checking in at a place',
    points: 10,
    category: 'general',
    cooldownSec: 86400,
    maxDaily: 10,
  },
  {
    key: 'daily_login',
    label: 'Daily Login',
    description: 'Logging in once per day',
    points: 10,
    category: 'daily',
    cooldownSec: 86400,
    maxDaily: 1,
  },
  {
    key: 'review_write',
    label: 'Write a Review',
    description: 'Writing a place review',
    points: 50,
    category: 'general',
    cooldownSec: 0,
    maxDaily: 10,
  },
  {
    key: 'photo_upload',
    label: 'Photo Upload',
    description: 'Adding photos with a place review',
    points: 5,
    category: 'general',
    cooldownSec: 0,
    maxDaily: 20,
  },
  {
    key: 'reel_upload',
    label: 'Creator Daily Reel',
    description: 'First travel reel upload of the day (creators only, once per day)',
    points: 50,
    category: 'creator',
    cooldownSec: 86400,
    maxDaily: 1,
  },
  {
    key: 'hidden_gem',
    label: 'Hidden Gem Approved',
    description: 'Bonus for the user whose hidden gem submission is approved (not for visitors)',
    points: 50,
    category: 'general',
    cooldownSec: 0,
    maxDaily: 5,
  },
  {
    key: 'quest',
    label: 'Quest Completion',
    description: 'Fallback points when a quest has no custom rewardPoints set',
    points: 50,
    category: 'quest',
    cooldownSec: 0,
    maxDaily: 20,
  },
  {
    key: 'game_complete',
    label: 'Game Completion',
    description: 'Completing an in-app mini-game (e.g. Memory Match)',
    points: 20,
    category: 'general',
    cooldownSec: 3600,
    maxDaily: 5,
  },
  {
    key: 'admin_bonus',
    label: 'Admin Bonus',
    description: 'Manual PalPoints adjustment — amount chosen by admin in Wallets',
    points: 0,
    category: 'admin',
    cooldownSec: 0,
    maxDaily: null,
  },
];

/** Keys that existed historically but have no award path — deactivated on seed/reset. */
export const DEPRECATED_POINT_RULE_KEYS = [
  'event',
  'daily_mission',
  'weekly_mission',
  'quiz_complete',
  'sponsored_checkin',
  'referral',
  'campaign_bonus',
  'vendor_promotion',
  'seasonal_reward',
  'treasure_hunt',
  'puzzle',
  'place_created',
  'place_approved',
  'like',
  'save',
  'share',
] as const;
