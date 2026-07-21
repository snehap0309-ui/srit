import { prisma } from './database';
import { logger } from './logger';
import bcrypt from 'bcryptjs';
import { Role, PlaceStatus, RoleAssignmentStatus } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { settingsService } from '../modules/settings/settings.service';
import { pointRulesService } from '../modules/point-rules/pointRules.service';
import { seedStreetStory } from './seed-data';
import { ensureBaseUserRole, upsertRoleStatus, syncUserPermissionFromRoles } from '../shared/utils/specialtyRoles';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

type CanonicalUser = {
  email: string;
  password: string;
  name: string;
  permission: Role;
  activeMode: Role;
};

/** Keep only: 1 admin, 1 tourist user, 1 vendor, 1 content creator. */
export const CANONICAL_KEEP_EMAILS = [
  'shivaay@palsafar.com',
  'user@palsafar.com',
  'streetstory@palsafar.com',
  'rahul.chelani@palsafar.com',
] as const;

const REQUIRED_USERS: CanonicalUser[] = [
  { email: 'shivaay@palsafar.com', password: 'google', name: 'Admin User', permission: Role.ADMIN, activeMode: Role.ADMIN },
  { email: 'user@palsafar.com', password: 'User@123', name: 'Test User', permission: Role.USER, activeMode: Role.USER },
  { email: 'streetstory@palsafar.com', password: process.env.SEED_VENDOR_PASSWORD || 'Vendor@123', name: 'Street Story', permission: Role.VENDOR, activeMode: Role.USER },
  { email: 'rahul.chelani@palsafar.com', password: process.env.SEED_CREATOR_PASSWORD || 'Creator@123', name: 'Rahul Chelani', permission: Role.CONTENT_CREATOR, activeMode: Role.USER },
];
function roleConfig(permission: Role): { permission: Role; activeMode: Role } {
  return { permission, activeMode: permission === Role.ADMIN ? Role.ADMIN : permission };
}

async function upsertCanonicalUser(
  email: string,
  password: string,
  name: string,
  permission: Role,
  activeMode?: Role,
): Promise<{ id: string; email: string }> {
  const hashed = await bcrypt.hash(password, 12);
  const config = { permission, activeMode: activeMode ?? roleConfig(permission).activeMode };
  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, name, ...config },
    create: { email, password: hashed, name, ...config },
    select: { id: true, email: true },
  });
  await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, palPoints: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
  });

  await ensureBaseUserRole(user.id);
  if (permission === Role.ADMIN) {
    await upsertRoleStatus({
      userId: user.id,
      role: Role.ADMIN,
      status: RoleAssignmentStatus.APPROVED,
    });
  } else if (permission === Role.VENDOR) {
    await upsertRoleStatus({
      userId: user.id,
      role: Role.VENDOR,
      status: RoleAssignmentStatus.APPROVED,
    });
  } else if (permission === Role.CONTENT_CREATOR) {
    await upsertRoleStatus({
      userId: user.id,
      role: Role.CONTENT_CREATOR,
      status: RoleAssignmentStatus.APPROVED,
    });
  }
  await syncUserPermissionFromRoles(user.id);

  return user;
}

async function syncCanonicalCredentials(): Promise<void> {
  // Production: require explicit opt-in. Dev/staging: sync unless explicitly disabled.
  const syncFlag = process.env.SYNC_CANONICAL_CREDENTIALS;
  if (syncFlag === 'false') {
    logger.info('Canonical credential sync disabled (SYNC_CANONICAL_CREDENTIALS=false)');
    return;
  }
  if (process.env.NODE_ENV === 'production' && syncFlag !== 'true') {
    logger.info('Canonical credential sync skipped in production (set SYNC_CANONICAL_CREDENTIALS=true only on disposable demo DBs)');
    return;
  }

  for (const acct of REQUIRED_USERS) {
    await upsertCanonicalUser(acct.email, acct.password, acct.name, acct.permission, acct.activeMode);
  }

  logger.info('Canonical test credentials synced (only the four protected test accounts)');
}

/**
 * Delete every user except the four canonical accounts.
 * Cleans dependent rows first — production DB has RESTRICT FKs on redemptions.offer_id.
 */
export async function pruneExtraUsers(): Promise<{ deleted: number; kept: string[] }> {
  const keep = [...CANONICAL_KEEP_EMAILS];
  const toDelete = await prisma.user.findMany({
    where: { email: { notIn: keep } },
    select: { id: true, email: true },
  });

  if (toDelete.length === 0) {
    logger.info({ keep }, 'No extra users to prune');
    return { deleted: 0, kept: keep };
  }

  const ids = toDelete.map((u) => u.id);

  const vendors = await prisma.vendor.findMany({
    where: { userId: { in: ids } },
    select: { id: true },
  });
  const vendorIds = vendors.map((v) => v.id);

  const offers = vendorIds.length
    ? await prisma.vendorOffer.findMany({
        where: { vendorId: { in: vendorIds } },
        select: { id: true },
      })
    : [];
  const offerIds = offers.map((o) => o.id);

  // Redemptions: production FK is ON DELETE RESTRICT on offer_id — must delete first
  if (offerIds.length || vendorIds.length || ids.length) {
    await prisma.redemption.deleteMany({
      where: {
        OR: [
          ...(offerIds.length ? [{ offerId: { in: offerIds } }] : []),
          ...(vendorIds.length ? [{ vendorId: { in: vendorIds } }] : []),
          { userId: { in: ids } },
          { verifiedById: { in: ids } },
          { refundedById: { in: ids } },
        ],
      },
    });
  }

  // Offers / vendor reels for vendors being removed (before user cascade)
  if (offerIds.length) {
    await prisma.vendorOffer.deleteMany({ where: { id: { in: offerIds } } });
  }
  if (vendorIds.length) {
    await prisma.vendorReel.deleteMany({ where: { vendorId: { in: vendorIds } } });
  }

  // Null optional FKs that block user deletes (prod still has RESTRICT on some)
  await prisma.place.updateMany({
    where: { submittedById: { in: ids } },
    data: { submittedById: null },
  });
  await prisma.place.updateMany({
    where: { approvedById: { in: ids } },
    data: { approvedById: null },
  });
  await prisma.vendor.updateMany({
    where: { reviewedById: { in: ids } },
    data: { reviewedById: null },
  });
  await prisma.user.updateMany({
    where: { verifiedById: { in: ids } },
    data: { verifiedById: null },
  });
  await prisma.vendorOffer.updateMany({
    where: { approvedById: { in: ids } },
    data: { approvedById: null },
  });
  await prisma.vendorOffer.updateMany({
    where: { rejectedById: { in: ids } },
    data: { rejectedById: null },
  });
  await prisma.auditLog.updateMany({
    where: { actorId: { in: ids } },
    data: { actorId: null },
  });

  const result = await prisma.user.deleteMany({
    where: { id: { in: ids } },
  });

  logger.info(
    { deleted: result.count, emails: toDelete.map((u) => u.email) },
    'Pruned extra users; kept admin, tourist, Street Story, Rahul Chelani',
  );
  return { deleted: result.count, kept: keep };
}

async function assertUserPermissionSchema(): Promise<void> {
  const columns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name IN ('permission', 'active_mode')
  `;

  if (columns.length < 2) {
    const message =
      'Database schema is missing users.permission / users.active_mode. ' +
      'Run migrations before starting the server: cd server && npx prisma migrate deploy';
    logger.fatal(message);
    throw new Error(message);
  }
}

export async function ensureSeedData(): Promise<void> {
  try {
    await assertUserPermissionSchema();
    await syncCanonicalCredentials();

    let adminUser = await prisma.user.findUnique({
      where: { email: 'shivaay@palsafar.com' },
    });

    logger.info('Default users seeded (admin, tourist, Street Story, Rahul Chelani)');
    // Seed system settings and point rules if empty
    const existingSettings = await prisma.systemSetting.count();
    if (existingSettings === 0) {
      await settingsService.seedDefaults();
      logger.info('Default system settings seeded');
    }

    const existingRules = await prisma.pointRule.count();
    if (existingRules === 0) {
      await pointRulesService.seedDefaults();
      logger.info('Default point rules seeded');
    }

    // Clear out any invalid places with coordinates (0, 0)
    await prisma.place.deleteMany({
      where: {
        latitude: 0,
        longitude: 0
      }
    });

    // Curated places are only synced when explicitly enabled (off by default — no hardcoded data)
    const syncCurated = process.env.SYNC_CURATED_PLACES === 'true';
    if (syncCurated) {
      const jsonPath = path.resolve(process.cwd(), 'prisma/seed-data/places-curated.json');
      if (!fs.existsSync(jsonPath)) {
        logger.error(`Syncing places failed: places-curated.json not found at ${jsonPath}`);
      } else {
        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const rawPlaces = JSON.parse(rawData);

        // Re-lookup admin for curated place attribution
        if (!adminUser) {
          adminUser = await prisma.user.findUnique({ where: { email: 'shivaay@palsafar.com' } });
        }

        if (adminUser) {
          const adminId = adminUser.id;
          const usedSlugs = new Set<string>();
          const placesToSync = rawPlaces.map((p: any) => {
            let slug = p.id || slugify(p.name);
            let counter = 1;
            while (usedSlugs.has(slug)) {
              slug = `${p.id || slugify(p.name)}-${counter}`;
              counter++;
            }
            usedSlugs.add(slug);

            return {
              name: p.name,
              slug,
              shortDescription: p.shortDescription || p.description?.substring(0, 200) || '',
              description: p.description || '',
              latitude: p.latitude || 0,
              longitude: p.longitude || 0,
              category: p.category,
              images: p.images || (p.imageUrl ? [p.imageUrl] : []),
              tags: p.tags || [],
              status: PlaceStatus.APPROVED,
              city: p.city || '',
              state: p.state || '',
              country: p.country || 'India',
              source: 'CURATED',
              submittedById: adminId,
              approvedById: adminId,
              reviewedAt: new Date(),
            };
          });

          logger.info(`Syncing ${placesToSync.length} curated places in database...`);
          const existingPlaces = await prisma.place.findMany({
            select: { slug: true }
          });
          const existingSlugs = new Set(existingPlaces.map(p => p.slug));

          let createdCount = 0;
          let skippedCount = 0;

          for (const p of placesToSync) {
            if (!existingSlugs.has(p.slug)) {
              await prisma.place.create({ data: p });
              createdCount++;
            } else {
              skippedCount++;
            }
          }
          logger.info(`Curated places synced. Created: ${createdCount}, Skipped: ${skippedCount}`);
        } else {
          logger.error('Syncing places failed: admin user not found.');
        }
      }
    }

    // Auto-run advanced seed check for vendors and reels
    await ensureAdvancedSeedData();

    // Seed Street Story vendor + Rahul Chelani creator
    await seedStreetStory(prisma);

    // Prune is OPT-IN only. Default keeps all users so real signups survive restarts.
    // Set PRUNE_EXTRA_USERS=true only on disposable demo DBs that must stay at 4 accounts.
    if (process.env.PRUNE_EXTRA_USERS === 'true') {
      try {
        await pruneExtraUsers();
      } catch (pruneErr) {
        logger.error({ err: pruneErr }, 'Failed to prune extra users (server will continue)');
      }
    }

  } catch (error) {
    logger.error({ err: error }, 'Failed to ensure seed data');
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}

async function ensureAdvancedSeedData(): Promise<void> {
  try {
    // Do not mass-seed vendor_user_* accounts. Street Story is seeded via seedStreetStory().
    const vendorCount = await prisma.vendor.count();
    logger.info({ vendorCount }, 'Vendor seed check (extra vendor users disabled)');
  } catch (error) {
    logger.error({ err: error }, 'Failed to ensure advanced seed data');
  }
}

