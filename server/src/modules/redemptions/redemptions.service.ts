import { prisma } from '../../config/database';
import { ApiError } from '../../shared/utils/ApiError';

import crypto from 'crypto';

function generateToken(): string {
  const bytes = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `PAL-${bytes}`;
}

function generateReceiptNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `RCP-${ts}-${rand}`;
}

export const redemptionsService = {
  async generate(userId: string, offerId: string) {
    return await prisma.$transaction(async (tx) => {
      // Lock offer row to prevent concurrent oversell of maxRedemptions
      const locked = await tx.$queryRaw<Array<{
        id: string;
        is_active: boolean;
        is_approved: boolean;
        points_required: number;
        discount_value: number;
        discount_type: string;
        title: string;
        vendor_id: string;
        max_redemptions: number | null;
        current_redemptions: number;
        daily_limit: number | null;
        business_name: string | null;
      }>>`
        SELECT o.id, o.is_active, o.is_approved, o.points_required, o.discount_value, o.discount_type,
               o.title, o.vendor_id, o.max_redemptions, o.current_redemptions, o.daily_limit,
               v.business_name as business_name
        FROM vendor_offers o
        JOIN vendors v ON v.id = o.vendor_id
        WHERE o.id = ${offerId}
        FOR UPDATE OF o
      `;
      if (!locked.length) throw new ApiError(404, 'Offer not found');
      const offer = locked[0]!;
      if (!offer.is_active) throw new ApiError(400, 'Offer is no longer active');
      if (!offer.is_approved) throw new ApiError(400, 'Offer has not been approved yet');

      if (offer.max_redemptions != null && offer.current_redemptions >= offer.max_redemptions) {
        throw new ApiError(400, 'This offer has reached maximum redemptions');
      }

      if (offer.daily_limit) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayRedemptions = await tx.redemption.count({
          where: {
            userId,
            offerId,
            createdAt: { gte: today },
          },
        });
        if (todayRedemptions >= offer.daily_limit) {
          throw new ApiError(400, 'Daily redemption limit reached for this offer');
        }
      }

      const walletUpdate = await tx.wallet.updateMany({
        where: { userId, palPoints: { gte: offer.points_required } },
        data: {
          palPoints: { decrement: offer.points_required },
          lifetimeSpent: { increment: offer.points_required }
        }
      });

      if (walletUpdate.count === 0) {
        throw new ApiError(400, `Insufficient Pal Points. Need ${offer.points_required}`);
      }

      const wallet = await tx.wallet.findUnique({ where: { userId } });

      const receiptNumber = generateReceiptNumber();
      const qrCode = generateToken();
      const redemption = await tx.redemption.create({
        data: {
          userId,
          offerId: offer.id,
          vendorId: offer.vendor_id,
          pointsSpent: offer.points_required,
          discountValue: offer.discount_value,
          discountType: offer.discount_type,
          qrCode,
          receiptNumber,
        },
      });

      if (wallet) {
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId,
            amount: -offer.points_required,
            type: 'SPEND',
            reason: `redeem:${offer.title}`,
            referenceId: redemption.id,
            referenceType: 'OFFER'
          }
        });
      }

      const token = generateToken();
      await tx.redemptionToken.create({
        data: {
          redemptionId: redemption.id,
          token,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      await tx.vendorOffer.update({
        where: { id: offerId },
        data: { currentRedemptions: { increment: 1 } },
      });

      return {
        ...redemption,
        token,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        vendorName: offer.business_name,
        offerTitle: offer.title,
      };
    });
  },

  async verify(token: string, vendorUserId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { userId: vendorUserId } });
    if (!vendor) throw new ApiError(403, 'No vendor account found');
    if (vendor.status !== 'APPROVED') throw new ApiError(403, 'Vendor not approved');

    return await prisma.$transaction(async (tx) => {
      const redemptionToken = await tx.redemptionToken.findUnique({
        where: { token },
        include: {
          redemption: {
            include: {
              offer: { select: { title: true } },
              vendor: { select: { businessName: true } },
            },
          },
        },
      });

      if (!redemptionToken) throw new ApiError(404, 'Invalid redemption token');
      if (new Date() > redemptionToken.expiresAt) throw new ApiError(400, 'Token has expired');
      if (redemptionToken.redemption.vendorId !== vendor.id) {
        throw new ApiError(403, 'This token is for a different vendor');
      }

      // Atomic single-use claim
      const claimed = await tx.redemptionToken.updateMany({
        where: { id: redemptionToken.id, usedAt: null },
        data: { usedAt: new Date(), usedById: vendorUserId },
      });
      if (claimed.count === 0) {
        throw new ApiError(400, 'This token has already been used');
      }

      const updated = await tx.redemption.update({
        where: { id: redemptionToken.redemptionId },
        data: {
          status: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedById: vendorUserId,
        },
      });

      return {
        ...updated,
        token,
        vendorName: redemptionToken.redemption.vendor?.businessName || 'Unknown Vendor',
        offerTitle: redemptionToken.redemption.offer?.title || 'Points Transfer',
      };
    });
  },

  async payPoints(userId: string, vendorCode: string, points: number) {
    return await prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findUnique({ where: { vendorCode } });
      if (!vendor) throw new ApiError(404, 'Vendor not found');
      if (vendor.status !== 'APPROVED') throw new ApiError(400, 'Vendor is not approved');
      if (vendor.userId === userId) {
        throw new ApiError(400, 'You cannot send points to your own business');
      }

      const walletUpdate = await tx.wallet.updateMany({
        where: { userId, palPoints: { gte: points } },
        data: {
          palPoints: { decrement: points },
          lifetimeSpent: { increment: points },
        },
      });

      if (walletUpdate.count === 0) {
        throw new ApiError(400, `Insufficient Pal Points. Need ${points}`);
      }

      const senderWallet = await tx.wallet.findUnique({ where: { userId } });
      if (!senderWallet) throw new ApiError(400, 'Wallet not found');

      // Ensure vendor wallet exists, then credit immediately (no QR / verify step).
      let vendorWallet = await tx.wallet.findUnique({ where: { userId: vendor.userId } });
      if (!vendorWallet) {
        vendorWallet = await tx.wallet.create({
          data: { userId: vendor.userId, palPoints: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
        });
      }
      vendorWallet = await tx.wallet.update({
        where: { userId: vendor.userId },
        data: {
          palPoints: { increment: points },
          lifetimeEarned: { increment: points },
        },
      });

      const receiptNumber = generateReceiptNumber();
      const qrCode = generateToken();
      const pointValue = (points * 0.5).toFixed(0);

      const redemption = await tx.redemption.create({
        data: {
          userId,
          vendorId: vendor.id,
          pointsSpent: points,
          discountValue: parseFloat(pointValue),
          discountType: 'FLAT',
          qrCode,
          receiptNumber,
          status: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedById: vendor.userId,
          notes: 'Instant points transfer via business code',
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: senderWallet.id,
          userId,
          amount: -points,
          type: 'SPEND',
          reason: `Sent to ${vendor.businessName}`,
          referenceId: redemption.id,
          referenceType: 'POINTS_TRANSFER',
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: vendorWallet.id,
          userId: vendor.userId,
          amount: points,
          type: 'EARN',
          reason: `Received from tourist`,
          referenceId: redemption.id,
          referenceType: 'POINTS_TRANSFER',
        },
      });

      return {
        id: redemption.id,
        pointsSpent: points,
        receiptNumber,
        vendorName: vendor.businessName,
        vendorCode: vendor.vendorCode,
        offerTitle: 'Points Transfer',
        rupeeValue: pointValue,
        status: 'VERIFIED',
      };
    });
  },

  async getUserRedemptions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.redemption.findMany({
        where: { userId },
        include: {
          offer: { select: { title: true, discountType: true, discountValue: true } },
          vendor: { select: { id: true, businessName: true } },
          token: { select: { token: true, expiresAt: true, usedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.redemption.count({ where: { userId } }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  },

  async getVendorRedemptions(vendorId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.redemption.findMany({
        where: { vendorId },
        include: {
          offer: { select: { title: true } },
          user: { select: { id: true, name: true, email: true } },
          token: { select: { token: true, expiresAt: true, usedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.redemption.count({ where: { vendorId } }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  },

  async refund(redemptionId: string, adminId: string, notes?: string) {
    return await prisma.$transaction(async (tx) => {
      const redemption = await tx.redemption.findUnique({ where: { id: redemptionId } });
      if (!redemption) throw new ApiError(404, 'Redemption not found');

      // Atomic claim of refund — second concurrent refund sees count 0
      const marked = await tx.redemption.updateMany({
        where: { id: redemptionId, refundedAt: null },
        data: {
          status: 'CANCELLED',
          refundedAt: new Date(),
          refundedById: adminId,
          notes,
        },
      });
      if (marked.count === 0) {
        throw new ApiError(400, 'Redemption already refunded');
      }

      if (redemption.userId && redemption.pointsSpent > 0) {
        await tx.wallet.update({
          where: { userId: redemption.userId },
          data: {
            palPoints: { increment: redemption.pointsSpent },
            lifetimeEarned: { increment: redemption.pointsSpent },
          },
        });
        const wallet = await tx.wallet.findUnique({ where: { userId: redemption.userId } });
        if (wallet) {
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              userId: redemption.userId,
              amount: redemption.pointsSpent,
              type: 'EARN',
              reason: `refund:${redemption.id}`,
              referenceId: redemption.id,
              referenceType: 'REFUND',
            },
          });
        }
      }

      return tx.redemption.findUnique({ where: { id: redemptionId } });
    });
  },

  async adminListAll(filters: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
    vendorId?: string;
    offerId?: string;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.userId) where.userId = filters.userId;
    if (filters.vendorId) where.vendorId = filters.vendorId;
    if (filters.offerId) where.offerId = filters.offerId;

    const [data, total] = await Promise.all([
      prisma.redemption.findMany({
        where,
        include: {
          offer: { select: { title: true } },
          user: { select: { id: true, name: true, email: true } },
          vendor: { select: { id: true, businessName: true } },
          token: { select: { token: true, expiresAt: true, usedAt: true } },
          refundedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.redemption.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  },
};
