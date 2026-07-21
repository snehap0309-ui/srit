import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { Role, RoleAssignmentStatus, VendorStatus } from '@prisma/client';
import { sendEmail } from '../../shared/utils/email';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { ApiError } from '../../shared/utils/ApiError';
import { RegisterInput, LoginInput } from './auth.validation';
import { eventBus, AppEvents } from '../../config/events';
import { awardDailyReward } from './daily-rewards';
import {
  assertCanActivate,
  enrichUserWithRoles,
  healSpecialtyRolesFromDomain,
  ensureBaseUserRole,
} from '../../shared/utils/specialtyRoles';
import { roleTransitionService } from '../../shared/services/roleTransition.service';

const ACCESS_TOKEN_EXPIRY = (env.jwt.expiresIn || '1h') as SignOptions['expiresIn'];
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ApiError(409, 'A user with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    // Create user + base USER role + wallet
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          name: input.name,
          permission: Role.USER,
          activeMode: Role.USER,
        },
        select: { id: true, email: true, name: true, permission: true, activeMode: true, createdAt: true },
      });
      await ensureBaseUserRole(created.id, tx);
      return created;
    });

    // Create wallet immediately after (outside transaction — OK if it fails, getOrCreate will handle it)
    try {
      await prisma.wallet.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, palPoints: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
      });
    } catch (err) {
      logger.warn({ err, userId: user.id }, 'Failed to create wallet at registration — will be created lazily');
    }

    const enriched = await enrichUserWithRoles(user);
    const accessToken = generateAccessToken(enriched);
    const refreshToken = await createRefreshToken(user.id);

    return { user: enriched, accessToken, refreshToken };
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        vendor: {
          select: { id: true, businessName: true, status: true, vendorCode: true },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
        checkIns: {
          select: {
            placeId: true,
          },
        },
        creatorProfile: {
          select: {
            id: true,
            username: true,
            fullName: true,
            bio: true,
            travelCategories: true,
            instagramUrl: true,
            youtubeUrl: true,
            sampleReelUrl: true,
            applicationReason: true,
            status: true,
            rejectionReason: true,
            followerCount: true,
            totalViews: true,
            verified: true,
          },
        },
      },
    });
    if (!user) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    const valid = await bcrypt.compare(input.password, user.password);
    if (!valid) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    const { password: _password, ...userWithoutPassword } = user;
    // Heal missing USER role rows on older accounts
    await ensureBaseUserRole(user.id);
    const enriched = await enrichUserWithRoles(userWithoutPassword);
    const accessToken = generateAccessToken(enriched);
    const refreshToken = await createRefreshToken(user.id);

    try {
      await awardDailyReward(user.id);
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to award daily login reward');
    }

    eventBus.emit(AppEvents.USER_LOGIN, { userId: user.id });

    return { user: enriched, accessToken, refreshToken };
  },

  async refresh(refreshTokenStr: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenStr },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new ApiError(401, 'Invalid or expired refresh token.');
    }

    // Rotate: revoke current atomically (conditional update prevents race)
    const revoked = await prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      throw new ApiError(401, 'Refresh token already used.');
    }

    const user = await prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true, name: true, permission: true, activeMode: true },
    });
    if (!user) {
      throw new ApiError(401, 'User not found.');
    }

    await ensureBaseUserRole(user.id);
    await healSpecialtyRolesFromDomain(user.id);
    // Re-read permission/activeMode after possible heal
    const fresh = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, permission: true, activeMode: true },
    });
    if (!fresh) {
      throw new ApiError(401, 'User not found.');
    }
    const enriched = await enrichUserWithRoles(fresh);
    const accessToken = generateAccessToken(enriched);
    const refreshToken = await createRefreshToken(user.id);

    return { accessToken, refreshToken };
  },

  async logout(refreshTokenStr: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenStr },
    });

    if (stored && !stored.revokedAt) {
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
    }
  },

  async getProfile(userId: string) {
    await ensureBaseUserRole(userId);
    // Promote UserRole when Vendor/Creator domain is already APPROVED (admin UI vs JWT desync).
    await healSpecialtyRolesFromDomain(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        permission: true,
        activeMode: true,
        bio: true,
        interests: true,
        avatarStyle: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            reviews: true,
          },
        },
        checkIns: {
          select: {
            placeId: true,
          },
        },
        creatorProfile: {
          select: {
            id: true,
            username: true,
            fullName: true,
            bio: true,
            travelCategories: true,
            instagramUrl: true,
            youtubeUrl: true,
            sampleReelUrl: true,
            applicationReason: true,
            status: true,
            rejectionReason: true,
            followerCount: true,
            totalViews: true,
            verified: true,
          },
        },
        vendor: {
          select: { id: true, businessName: true, status: true, vendorCode: true },
        },
      },
    });
    if (!user) {
      throw new ApiError(404, 'User not found.');
    }
    return enrichUserWithRoles(user);
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      logger.info({ email }, 'Password reset requested for non-existent email');
      return { success: true };
    }

    // ~48 bits of entropy, typeable 8-char code (Crockford alphabet, no ambiguous chars)
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(8);
    let code = '';
    for (let i = 0; i < 8; i++) code += alphabet[bytes[i]! % alphabet.length];
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const hashedToken = crypto.createHash('sha256').update(code).digest('hex');

    await prisma.passwordResetToken.upsert({
      where: { email },
      update: { token: hashedToken, expiresAt },
      create: { email, token: hashedToken, expiresAt },
    });

    const emailSubject = 'PalSafar - Password Reset Code';
    const emailText = `Your password reset code is: ${code}\n\nIt expires in 15 minutes.`;
    await sendEmail(email, emailSubject, emailText);

    logger.info({ email }, 'Password reset code generated');

    return { success: true };
  },

  async resetPassword(email: string, token: string, passwordStr: string) {
    const record = await prisma.passwordResetToken.findUnique({
      where: { email },
    });

    const hashedInputToken = crypto.createHash('sha256').update(token.toUpperCase()).digest('hex');

    if (!record || record.token !== hashedInputToken || record.expiresAt < new Date()) {
      throw new ApiError(400, 'Invalid or expired verification code.');
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new ApiError(400, 'Invalid or expired verification code.');

    await prisma.passwordResetToken.delete({ where: { email } });

    const hashedPassword = await bcrypt.hash(passwordStr, 12);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    await revokeAllRefreshTokens(user.id);

    return { success: true };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (!user) throw new ApiError(404, 'User not found.');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new ApiError(400, 'Current password is incorrect.');

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });

    await revokeAllRefreshTokens(userId);

    return { success: true };
  },

  async getDeletionInfo(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        permission: true,
        wallet: { select: { palPoints: true } },
        vendor: { select: { id: true, status: true, businessName: true } },
        creatorProfile: { select: { id: true, status: true, username: true } },
        _count: {
          select: {
            redemptions: { where: { status: 'PENDING' } },
          },
        },
      },
    });
    if (!user) throw new ApiError(404, 'User not found.');

    return {
      palPoints: user.wallet?.palPoints ?? 0,
      pendingRedemptions: user._count.redemptions,
      vendor: user.vendor
        ? { id: user.vendor.id, status: user.vendor.status, businessName: user.vendor.businessName }
        : null,
      creator: user.creatorProfile
        ? {
            id: user.creatorProfile.id,
            status: user.creatorProfile.status,
            username: user.creatorProfile.username,
          }
        : null,
      canSelfDelete: user.permission !== Role.ADMIN,
    };
  },

  async deleteAccount(userId: string, password: string, confirmDeletion: boolean) {
    if (!confirmDeletion) {
      throw new ApiError(400, 'Account deletion must be explicitly confirmed.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        permission: true,
        wallet: { select: { palPoints: true } },
        vendor: { select: { id: true } },
        creatorProfile: { select: { id: true } },
        _count: { select: { redemptions: { where: { status: 'PENDING' } } } },
      },
    });
    if (!user) throw new ApiError(404, 'User not found.');
    if (user.permission === Role.ADMIN) {
      throw new ApiError(403, 'Admin accounts cannot be deleted from the app.');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new ApiError(400, 'Password is incorrect.');

    const forfeitedPalPoints = user.wallet?.palPoints ?? 0;
    const cancelledPendingRedemptions = user._count.redemptions;

    // Permanent delete — schema has no soft-delete column; related rows cascade or null per Prisma.
    await prisma.$transaction(async (tx) => {
      await tx.redemption.updateMany({
        where: { userId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.user.delete({ where: { id: userId } });
    }, { maxWait: 10_000, timeout: 20_000 });

    return {
      deleted: true,
      forfeitedPalPoints,
      cancelledPendingRedemptions,
      vendorRemoved: !!user.vendor,
      creatorRemoved: !!user.creatorProfile,
    };
  },

  async updateProfile(userId: string, data: any) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.interests !== undefined) updateData.interests = data.interests;
    if (data.avatarStyle !== undefined) updateData.avatarStyle = data.avatarStyle;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        permission: true,
        activeMode: true,
        bio: true,
        interests: true,
        avatarStyle: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            reviews: true,
          },
        },
        checkIns: {
          select: {
            placeId: true,
          },
        },
        creatorProfile: {
          select: {
            id: true,
            username: true,
            fullName: true,
            bio: true,
            travelCategories: true,
            instagramUrl: true,
            youtubeUrl: true,
            sampleReelUrl: true,
            applicationReason: true,
            status: true,
            rejectionReason: true,
            followerCount: true,
            totalViews: true,
            verified: true,
          },
        },
        vendor: {
          select: { id: true, businessName: true, status: true, vendorCode: true },
        },
      },
    });

    return enrichUserWithRoles(updated);
  },

  async setActiveMode(userId: string, activeMode: Role) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        permission: true,
        activeMode: true,
      },
    });
    if (!user) throw new ApiError(404, 'User not found.');

    await ensureBaseUserRole(userId);
    await assertCanActivate(userId, activeMode);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { activeMode },
      select: {
        id: true,
        email: true,
        name: true,
        permission: true,
        activeMode: true,
        creatorProfile: {
          select: {
            id: true,
            username: true,
            fullName: true,
            bio: true,
            travelCategories: true,
            instagramUrl: true,
            youtubeUrl: true,
            sampleReelUrl: true,
            applicationReason: true,
            rejectionReason: true,
            status: true,
            followerCount: true,
            totalViews: true,
            verified: true,
          },
        },
        vendor: {
          select: { id: true, businessName: true, status: true, vendorCode: true },
        },
      },
    });
    const enriched = await enrichUserWithRoles(updated);
    return {
      user: enriched,
      accessToken: generateAccessToken(enriched),
    };
  },

  async setupVendor(emailOverride?: string) {
    const email = emailOverride || process.env.SEED_VENDOR_EMAIL || 'vendor_user_1@palsafar.com';
    const password = process.env.SEED_VENDOR_PASSWORD || 'Vendor@123';
    const name = 'Madan Mahal Heritage Cafe';

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        permission: Role.VENDOR,
        activeMode: Role.VENDOR,
        password: hashedPassword,
      },
      create: {
        email,
        name,
        permission: Role.VENDOR,
        activeMode: Role.VENDOR,
        password: hashedPassword,
      },
    });

    let vendor = await prisma.vendor.findUnique({ where: { userId: user.id } });
    if (!vendor) {
      const admin = await prisma.user.findFirst({ where: { permission: Role.ADMIN } });
      vendor = await prisma.vendor.create({
        data: {
          userId: user.id,
          businessName: name,
          businessType: 'restaurant',
          phone: '+91 98765 43200',
          address: 'Street No. 1, Near Center, Jabalpur',
          city: 'Jabalpur',
          state: 'Madhya Pradesh',
          latitude: 23.161,
          longitude: 79.902,
          description: 'A cozy cafe near the historic Madan Mahal Fort serving delicious snacks.',
          imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=480',
          operatingHours: '09:00 AM - 10:00 PM',
          status: VendorStatus.APPROVED,
          reviewedById: admin?.id ?? null,
          reviewedAt: new Date(),
          showOnMap: true,
          showContact: true,
          showWebsite: true,
          showImages: true,
          showOffers: true,
          showReels: true,
          showNavigation: true,
        },
      });
    }

    await roleTransitionService.applyVerificationOutcome({
      userId: user.id,
      role: Role.VENDOR,
      status: RoleAssignmentStatus.APPROVED,
    });

    const refreshed = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { id: true, email: true, name: true, permission: true, activeMode: true },
    });

    return {
      ...(await enrichUserWithRoles(refreshed)),
      vendorId: vendor.id,
      vendorStatus: vendor.status,
    };
  },
};

export function generateAccessToken(user: {
  id: string;
  email: string;
  permission: Role;
  activeMode: Role;
  name: string;
  roles?: Role[];
  approvedRoles?: Role[];
}): string {
  const roles = user.approvedRoles ?? user.roles ?? (
    user.permission === Role.ADMIN
      ? [Role.ADMIN]
      : user.permission === Role.USER
        ? [Role.USER]
        : [Role.USER, user.permission]
  );

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      permission: user.permission,
      activeMode: user.activeMode,
      roles,
      role: user.permission,
      activeRole: user.activeMode,
      name: user.name,
      jti: crypto.randomUUID(),
    },
    env.jwt.secret,
    { expiresIn: ACCESS_TOKEN_EXPIRY, algorithm: 'HS256' },
  );
}

async function createRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });

  return token;
}


