import { AuditAction, Role, RoleAssignmentStatus, VendorStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../shared/utils/ApiError';
import { auditService } from '../audit/audit.service';
import { eventBus, AppEvents } from '../../config/events';
import crypto from 'crypto';
import type { RegisterVendorInput, UpdateVendorInput, AdminUpdateVendorInput, CreateOfferInput, UpdateOfferInput, CreateVendorReelInput, ApproveOfferInput, RejectOfferInput, VendorReviewInput } from './vendors.validation';
import { getPaginationParams, paginatedResponse } from '../../shared/utils/pagination';
import { mapVendorStatusToRoleStatus } from '../../shared/utils/specialtyRoles';
import { roleTransitionService } from '../../shared/services/roleTransition.service';
import { notificationService } from '../notifications/notification.service';

function generateVendorCode(businessName: string, _vendorId: string): string {
  const prefix = businessName
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `VND-${prefix}-${ts}-${rand}`;
}

const vendorSelect = {
  id: true,
  userId: true,
  businessName: true,
  businessType: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  latitude: true,
  longitude: true,
  description: true,
  imageUrl: true,
  website: true,
  operatingHours: true,
  images: true,
  gstNumber: true,
  documents: true,
  status: true,
  rejectionReason: true,
  vendorCode: true,
  linkedSpotIds: true,
  services: true,
  showOnMap: true,
  showContact: true,
  showWebsite: true,
  showImages: true,
  showOffers: true,
  showReels: true,
  showNavigation: true,
  rating: true,
  reviewCount: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true } },
};

export const vendorsService = {
  async register(input: RegisterVendorInput, userId: string) {
    const retireReason = 'Your Content Creator role was retired because you switched to Vendor.';
    const RESUBMITTABLE_STATUSES: VendorStatus[] = [
      VendorStatus.REJECTED,
      VendorStatus.CHANGES_REQUESTED,
      VendorStatus.RETIRED,
    ];

    const vendorData = {
      businessName: input.businessName,
      businessType: (input.businessType || (input as any).category || 'local_shop') as any,
      phone: input.phone,
      address: input.address,
      city: input.city,
      state: input.state,
      latitude: input.latitude,
      longitude: input.longitude,
      description: input.description,
      imageUrl: input.imageUrl,
      website: input.website,
      operatingHours: input.operatingHours || (input as any).openingHours,
      images: input.images,
      gstNumber: input.gstNumber,
      documents: input.documents,
      linkedSpotIds: input.linkedSpotIds,
      services: input.services || undefined,
      showOnMap: input.showOnMap,
      showContact: input.showContact,
      showWebsite: input.showWebsite,
      showImages: input.showImages,
      showOffers: input.showOffers,
      showReels: input.showReels,
      showNavigation: input.showNavigation,
    };

    const result = await prisma.$transaction(async (tx) => {
      const { isSwitch, otherRole } = await roleTransitionService.assertCanApply(
        userId,
        Role.VENDOR,
        input.confirmSwitch,
        tx,
      );

      const existing = await tx.vendor.findUnique({ where: { userId } });
      if (existing && !RESUBMITTABLE_STATUSES.includes(existing.status)) {
        // Vendor row exists in a live state (e.g. PAUSED) that isn't ours to resubmit — no-op
        // BEFORE retiring anything, so a blocked application never costs the user their other role.
        return { vendor: existing, created: false, resubmitted: false, retiredOther: false, otherRole };
      }

      if (isSwitch) {
        await roleTransitionService.retireRole(userId, otherRole, userId, retireReason, tx);
      }

      let vendor;
      let created = false;
      let resubmitted = false;

      if (existing) {
        vendor = await tx.vendor.update({
          select: vendorSelect,
          where: { userId },
          data: {
            ...vendorData,
            businessType: (input.businessType || (input as any).category || existing.businessType) as any,
            status: VendorStatus.PENDING,
            rejectionReason: null,
            reviewedById: null,
            reviewedAt: null,
          },
        });
        resubmitted = true;
      } else {
        vendor = await tx.vendor.create({
          select: vendorSelect,
          data: { userId, ...vendorData },
        });
        created = true;
      }

      // Same transaction client so the audit trail commits (or rolls back) with the application.
      await tx.auditLog.create({
        data: {
          action: AuditAction.VENDOR_REGISTERED,
          entityType: 'Vendor',
          entityId: vendor.id,
          actorId: userId,
          previous: existing ? { status: existing.status } : undefined,
          newValues: input as any,
        },
      });

      await roleTransitionService.finalizeApplication(userId, Role.VENDOR, tx);

      return { vendor, created, resubmitted, retiredOther: isSwitch, otherRole };
    }, { maxWait: 10_000, timeout: 20_000 });

    if (result.retiredOther) {
      roleTransitionService.notifyRetirement(userId, result.otherRole, retireReason);
    }

    return { vendor: result.vendor, created: result.created, resubmitted: result.resubmitted };
  },

  async getMyVendor(userId: string) {
    let vendor = await prisma.vendor.findUnique({
      where: { userId },
      select: {
        ...vendorSelect,
        offers: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Backfill business code for vendors approved before codes existed.
    if (vendor && vendor.status === 'APPROVED' && !vendor.vendorCode) {
      const vendorCode = generateVendorCode(vendor.businessName, vendor.id);
      vendor = await prisma.vendor.update({
        where: { id: vendor.id },
        data: { vendorCode },
        select: {
          ...vendorSelect,
          offers: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    return vendor;
  },

  async updateMyVendor(userId: string, input: UpdateVendorInput) {
    const vendor = await prisma.vendor.findUnique({ where: { userId } });
    if (!vendor) throw new ApiError(404, 'Vendor not found');

    // Security: if approved vendor changes coordinates, reset to PENDING
    const coordsChanged =
      vendor.status === 'APPROVED' &&
      ((input.latitude !== undefined && input.latitude !== vendor.latitude) ||
       (input.longitude !== undefined && input.longitude !== vendor.longitude));

    const data: any = { ...input };
    if (coordsChanged) {
      data.status = 'PENDING';
      data.reviewedAt = null;
      data.reviewedById = null;
    }

    if (coordsChanged) {
      return prisma.$transaction(async (tx) => {
        const updated = await tx.vendor.update({
          select: vendorSelect,
          where: { userId },
          data,
        });
        await roleTransitionService.applyVerificationOutcome({
          userId,
          role: Role.VENDOR,
          status: RoleAssignmentStatus.PENDING,
          tx,
        });
        return updated;
      });
    }

    return prisma.vendor.update({
      select: vendorSelect,
      where: { userId },
      data,
    });
  },

  async listByType(businessType: string, query: { city?: string; state?: string; page?: string; limit?: string; search?: string }) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;
    const where: any = { businessType, status: 'APPROVED' };

    if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
    if (query.state) where.state = { contains: query.state, mode: 'insensitive' };
    if (query.search) {
      where.OR = [
        { businessName: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.vendor.findMany({
        select: {
          ...vendorSelect,
          services: true,
        },
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vendor.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  },

  async list(query: { status?: string; page?: string; limit?: string; search?: string }) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;
    const where: any = {};

    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { businessName: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
        { state: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.vendor.findMany({
        select: vendorSelect,
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vendor.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  },

  async getById(id: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      select: {
        ...vendorSelect,
        offers: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
        reels: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!vendor) throw new ApiError(404, 'Vendor not found');
    return vendor;
  },

  // ── Public endpoints for mobile app ──

  async listNearbyApproved() {
    const vendors = await prisma.vendor.findMany({
      where: {
        status: 'APPROVED',
        showOnMap: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        latitude: true,
        longitude: true,
        city: true,
        state: true,
        imageUrl: true,
        description: true,
        showContact: true,
        showWebsite: true,
        showImages: true,
        showOffers: true,
        showReels: true,
        showNavigation: true,
      },
    });
    return vendors;
  },

  async listApprovedForMap() {
    const vendors = await prisma.vendor.findMany({
      where: {
        status: 'APPROVED',
        showOnMap: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        description: true,
        imageUrl: true,
        website: true,
        operatingHours: true,
        images: true,
        showOnMap: true,
        showContact: true,
        showWebsite: true,
        showImages: true,
        showOffers: true,
        showReels: true,
        showNavigation: true,
        linkedSpotIds: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return vendors;
  },

  async getPublicDetails(id: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id, status: 'APPROVED' },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        description: true,
        address: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        imageUrl: true,
        website: true,
        operatingHours: true,
        images: true,
        phone: true,
        showContact: true,
        showWebsite: true,
        showImages: true,
        showOffers: true,
        showReels: true,
        showNavigation: true,
        rating: true,
        reviewCount: true,
        offers: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            discountType: true,
            discountValue: true,
            pointsRequired: true,
            validTill: true,
          },
        },
      },
    });
    if (!vendor) throw new ApiError(404, 'Vendor not found');

    // Redact fields the vendor chose to hide
    const result: any = { ...vendor };
    if (!vendor.showContact) { result.phone = null; }
    if (!vendor.showWebsite) { result.website = null; }
    if (!vendor.showImages) { result.images = []; }
    if (!vendor.showOffers) { result.offers = []; }

    return result;
  },

  async recalculateVendorRating(vendorId: string) {
    const result = await prisma.vendorReview.aggregate({
      where: { vendorId },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        rating: result._avg.rating ? Number(result._avg.rating.toFixed(1)) : null,
        reviewCount: result._count,
      },
    });
  },

  async addReview(vendorId: string, userId: string, input: VendorReviewInput) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, status: true, userId: true },
    });
    if (!vendor || vendor.status !== 'APPROVED') {
      throw new ApiError(404, 'Vendor not found');
    }
    if (vendor.userId === userId) {
      throw new ApiError(400, 'You cannot review your own shop.');
    }

    const reviewUserSelect = { id: true, name: true, avatarStyle: true, avatar: true } as const;
    const existing = await prisma.vendorReview.findUnique({
      where: { vendorId_userId: { vendorId, userId } },
    });

    if (existing) {
      const review = await prisma.vendorReview.update({
        where: { id: existing.id },
        data: { rating: input.rating, content: input.content, photos: input.photos },
        include: { user: { select: reviewUserSelect } },
      });
      await this.recalculateVendorRating(vendorId);
      return review;
    }

    const review = await prisma.vendorReview.create({
      data: {
        vendorId,
        userId,
        rating: input.rating,
        content: input.content,
        photos: input.photos,
      },
      include: { user: { select: reviewUserSelect } },
    });
    await this.recalculateVendorRating(vendorId);
    return review;
  },

  async getReviews(vendorId: string, query: { page?: string; limit?: string }) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });
    if (!vendor) throw new ApiError(404, 'Vendor not found');

    const pagination = getPaginationParams(query);
    const [data, total] = await Promise.all([
      prisma.vendorReview.findMany({
        where: { vendorId },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ helpfulVotes: 'desc' }, { createdAt: 'desc' }],
        include: {
          user: { select: { id: true, name: true, avatarStyle: true, avatar: true } },
        },
      }),
      prisma.vendorReview.count({ where: { vendorId } }),
    ]);

    return paginatedResponse(data, total, pagination);
  },

  async markReviewHelpful(vendorId: string, reviewId: string) {
    const review = await prisma.vendorReview.findUnique({ where: { id: reviewId, vendorId } });
    if (!review) throw new ApiError(404, 'Review not found.');
    return prisma.vendorReview.update({
      where: { id: reviewId },
      data: { helpfulVotes: { increment: 1 } },
    });
  },

  // ── Vendor Reels ──

  async listVendorReels(vendorId: string) {
    return prisma.vendorReel.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createVendorReel(vendorId: string, input: CreateVendorReelInput) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new ApiError(404, 'Vendor not found');
    if (vendor.status !== 'APPROVED') throw new ApiError(403, 'Vendor must be approved to create reels');

    const capable = await prisma.userRole.findFirst({
      where: {
        userId: vendor.userId,
        role: Role.VENDOR,
        status: { in: [RoleAssignmentStatus.APPROVED, RoleAssignmentStatus.ACTIVE] },
      },
    });
    if (!capable) {
      throw new ApiError(403, 'Vendor role is not active on this account.');
    }

    return prisma.vendorReel.create({
      data: {
        vendorId,
        videoUrl: input.videoUrl,
        thumbnail: input.thumbnail,
        title: input.title,
        description: input.description,
      },
    });
  },

  async deleteVendorReel(vendorId: string, reelId: string) {
    const reel = await prisma.vendorReel.findUnique({ where: { id: reelId } });
    if (!reel) throw new ApiError(404, 'Reel not found');
    if (reel.vendorId !== vendorId) throw new ApiError(403, 'Not your reel');
    await prisma.vendorReel.delete({ where: { id: reelId } });
  },

  // ── Admin ──

  async adminUpdate(id: string, input: AdminUpdateVendorInput, adminId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new ApiError(404, 'Vendor not found');

    const updated = await prisma.vendor.update({
      select: vendorSelect,
      where: { id },
      data: input,
    });

    await auditService.log(AuditAction.VENDOR_VERIFIED, 'Vendor', id, adminId, null, null, input as any);
    return updated;
  },

  async verify(
    id: string,
    status: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'SUSPENDED' | 'PAUSED',
    adminId: string,
    rejectionReason?: string,
  ) {
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new ApiError(404, 'Vendor not found');

    const vendorStatus = status as VendorStatus;
    const roleStatus = mapVendorStatusToRoleStatus(vendorStatus);

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.vendor.update({
        select: vendorSelect,
        where: { id },
        data: {
          status: vendorStatus,
          rejectionReason: status === 'APPROVED' ? null : (rejectionReason ?? vendor.rejectionReason),
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });

      await roleTransitionService.applyVerificationOutcome({
        userId: vendor.userId,
        role: Role.VENDOR,
        status: roleStatus,
        approvedById: adminId,
        rejectedReason: status === 'APPROVED' ? null : (rejectionReason ?? null),
        tx,
      });
      return row;
    });

    if (status === 'APPROVED') {
      const vendorCode = vendor.vendorCode || generateVendorCode(vendor.businessName, vendor.id);
      if (!vendor.vendorCode) {
        await prisma.vendor.update({
          where: { id },
          data: { vendorCode },
        });
      }
      await auditService.log(
        AuditAction.VENDOR_VERIFIED,
        'Vendor',
        id,
        adminId,
        null,
        { status: vendor.status },
        { status, vendorCode },
      );
      notificationService
        .sendToUser(
          vendor.userId,
          'Vendor Approved',
          'Your business account was approved. Switch profile to Vendor mode anytime.',
          { vendorId: id, status },
          'vendor_approved',
        )
        .catch(() => undefined);
      return { ...updated, vendorCode, status: vendorStatus };
    }

    await auditService.log(
      AuditAction.VENDOR_REJECTED,
      'Vendor',
      id,
      adminId,
      null,
      { status: vendor.status },
      { status, rejectionReason },
    );

    const titles: Record<string, string> = {
      REJECTED: 'Vendor Rejected',
      CHANGES_REQUESTED: 'Vendor Changes Requested',
      SUSPENDED: 'Vendor Suspended',
      PAUSED: 'Vendor Paused',
    };
    notificationService
      .sendToUser(
        vendor.userId,
        titles[status] || 'Vendor Update',
        rejectionReason || `Your vendor application status is now ${status}.`,
        { vendorId: id, status },
        `vendor_${status.toLowerCase()}`,
      )
      .catch(() => undefined);

    return updated;
  },

  async deleteVendor(id: string, adminId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new ApiError(404, 'Vendor not found');

    await prisma.$transaction(async (tx) => {
      await tx.vendor.delete({ where: { id } });
      await roleTransitionService.applyVerificationOutcome({
        userId: vendor.userId,
        role: Role.VENDOR,
        status: RoleAssignmentStatus.REJECTED,
        approvedById: adminId,
        rejectedReason: 'Deleted by admin',
        tx,
      });
      await tx.auditLog.create({
        data: {
          action: AuditAction.VENDOR_REJECTED,
          entityType: 'Vendor',
          entityId: id,
          actorId: adminId,
          previous: { status: vendor.status },
          newValues: { deleted: true },
        },
      });
    });
    return { message: 'Vendor deleted' };
  },

  async createOffer(vendorId: string, input: CreateOfferInput) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!vendor) throw new ApiError(404, 'Vendor not found');
    if (vendor.status !== 'APPROVED') throw new ApiError(403, 'Vendor must be approved to create offers');

    const offer = await prisma.vendorOffer.create({
      data: {
        vendorId,
        title: input.title,
        description: input.description,
        discountType: input.discountType,
        discountValue: input.discountValue,
        pointsRequired: input.pointsRequired,
        minBillAmount: input.minBillAmount,
        couponCode: input.couponCode,
        dailyLimit: input.dailyLimit,
        validTill: input.validTill,
        startDate: input.startDate ? new Date(input.startDate) : null,
      },
    });

    eventBus.emit(AppEvents.OFFER_CREATED, {
      offerId: offer.id,
      vendorUserId: vendor.userId,
      vendorName: vendor.user.name || vendor.businessName,
      offerTitle: input.title,
    });

    return offer;
  },

  async updateOffer(offerId: string, vendorId: string, input: UpdateOfferInput) {
    const offer = await prisma.vendorOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new ApiError(404, 'Offer not found');
    if (offer.vendorId !== vendorId) throw new ApiError(403, 'Not your offer');

    const data: Record<string, unknown> = { ...input };
    if (input.startDate !== undefined) {
      data.startDate = input.startDate ? new Date(input.startDate) : null;
    }

    return prisma.vendorOffer.update({
      where: { id: offerId },
      data,
    });
  },

  async listOffers(vendorId: string) {
    return prisma.vendorOffer.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async deleteOffer(offerId: string, vendorId: string) {
    const offer = await prisma.vendorOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new ApiError(404, 'Offer not found');
    if (offer.vendorId !== vendorId) throw new ApiError(403, 'Not your offer');
    await prisma.vendorOffer.delete({ where: { id: offerId } });
  },

  async getPublicOffers(query: { city?: string; vendorId?: string }) {
    const where: any = { isActive: true, isApproved: true };
    if (query.vendorId) where.vendorId = query.vendorId;

    where.OR = [
      { startDate: null },
      { startDate: { lte: new Date() } },
    ];

    return prisma.vendorOffer.findMany({
      where,
      include: {
        vendor: { select: { id: true, businessName: true, city: true, state: true, imageUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getOfferById(offerId: string) {
    const offer = await prisma.vendorOffer.findUnique({
      where: { id: offerId },
      include: {
        vendor: {
          select: { id: true, businessName: true, businessType: true, city: true, state: true, imageUrl: true, latitude: true, longitude: true },
        },
      },
    });
    if (!offer) throw new ApiError(404, 'Offer not found');
    return offer;
  },

  async approveOffer(offerId: string, adminId: string, input: ApproveOfferInput = {}) {
    const offer = await prisma.vendorOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new ApiError(404, 'Offer not found');
    if (offer.isApproved) throw new ApiError(409, 'Offer already approved');

    const updated = await prisma.vendorOffer.update({
      where: { id: offerId },
      data: {
        isApproved: true,
        approvedById: adminId,
        approvedAt: new Date(),
        rejectionReason: null,
        rejectedById: null,
        rejectedAt: null,
        isFeatured: input.isFeatured ?? offer.isFeatured,
      },
    });

    eventBus.emit(AppEvents.OFFER_APPROVED, {
      offerId: updated.id,
      offerTitle: updated.title,
      vendorId: offer.vendorId,
    });

    return updated;
  },

  async rejectOffer(offerId: string, adminId: string, input: RejectOfferInput) {
    const offer = await prisma.vendorOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new ApiError(404, 'Offer not found');
    if (offer.isApproved) throw new ApiError(409, 'Offer already approved, cannot reject');

    const updated = await prisma.vendorOffer.update({
      where: { id: offerId },
      data: {
        isApproved: false,
        isActive: false,
        rejectionReason: input.rejectionReason,
        rejectedById: adminId,
        rejectedAt: new Date(),
        approvedById: null,
        approvedAt: null,
      },
    });

    eventBus.emit(AppEvents.OFFER_REJECTED, {
      offerId: updated.id,
      offerTitle: updated.title,
      vendorId: offer.vendorId,
      reason: input.rejectionReason,
    });

    return updated;
  },

  async pauseOffer(offerId: string, vendorId: string) {
    const offer = await prisma.vendorOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new ApiError(404, 'Offer not found');
    if (offer.vendorId !== vendorId) throw new ApiError(403, 'Not your offer');
    if (!offer.isActive) throw new ApiError(409, 'Offer is already paused');

    return prisma.vendorOffer.update({
      where: { id: offerId },
      data: { isActive: false, pausedAt: new Date() },
    });
  },

  async resumeOffer(offerId: string, vendorId: string) {
    const offer = await prisma.vendorOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new ApiError(404, 'Offer not found');
    if (offer.vendorId !== vendorId) throw new ApiError(403, 'Not your offer');
    if (offer.isActive) throw new ApiError(409, 'Offer is already active');
    if (!offer.isApproved) throw new ApiError(403, 'Cannot resume unapproved offer');

    return prisma.vendorOffer.update({
      where: { id: offerId },
      data: { isActive: true, pausedAt: null },
    });
  },

  async duplicateOffer(offerId: string, vendorId: string) {
    const offer = await prisma.vendorOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new ApiError(404, 'Offer not found');
    if (offer.vendorId !== vendorId) throw new ApiError(403, 'Not your offer');

    return prisma.vendorOffer.create({
      data: {
        vendorId,
        title: `${offer.title} (Copy)`,
        description: offer.description,
        banner: offer.banner,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        pointsRequired: offer.pointsRequired,
        minBillAmount: offer.minBillAmount,
        couponCode: null,
        dailyLimit: offer.dailyLimit,
        validTill: offer.validTill,
        category: offer.category,
        imageUrl: offer.imageUrl,
        maxRedemptions: offer.maxRedemptions,
        isFeatured: false,
        isApproved: false,
        isActive: false,
      },
    });
  },

  async recordOfferView(offerId: string) {
    await prisma.vendorOffer.update({
      where: { id: offerId },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});
  },

  async recordOfferClick(offerId: string) {
    await prisma.vendorOffer.update({
      where: { id: offerId },
      data: { clickCount: { increment: 1 } },
    }).catch(() => {});
  },

  // ── Dashboard & Analytics ──

  async getDashboardStats(vendorId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [vendor, offers, redemptions, todayRedemptions] = await Promise.all([
      prisma.vendor.findUnique({
        where: { id: vendorId },
        select: {
          id: true, businessName: true, businessType: true, status: true, imageUrl: true,
          city: true, state: true, vendorCode: true, createdAt: true,
          rating: true, reviewCount: true,
        },
      }),
      prisma.vendorOffer.findMany({
        where: { vendorId },
        select: {
          id: true, title: true, discountType: true, discountValue: true, pointsRequired: true,
          isApproved: true, isActive: true, rejectionReason: true, currentRedemptions: true, maxRedemptions: true,
          viewCount: true, clickCount: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.redemption.findMany({
        where: { vendorId },
        select: { id: true, status: true, pointsSpent: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.redemption.count({
        where: { vendorId, createdAt: { gte: today }, status: 'VERIFIED' },
      }),
    ]);

    if (!vendor) throw new ApiError(404, 'Vendor not found');

    const totalRedemptions = redemptions.length;
    const verifiedRedemptions = redemptions.filter(r => r.status === 'VERIFIED');
    const totalPointsRedeemed = verifiedRedemptions.reduce((sum, r) => sum + r.pointsSpent, 0);
    const totalOffers = offers.length;
    const activeOffers = offers.filter(o => o.isActive && o.isApproved);
    const pendingOffers = offers.filter(o => !o.isApproved && !o.rejectionReason);
    const totalViews = offers.reduce((sum, o) => sum + o.viewCount, 0);
    const totalClicks = offers.reduce((sum, o) => sum + o.clickCount, 0);

    return {
      vendor,
      stats: {
        totalOffers,
        activeOffers: activeOffers.length,
        pendingApproval: pendingOffers.length,
        totalRedemptions,
        verifiedRedemptions: verifiedRedemptions.length,
        todayRedemptions,
        totalPointsRedeemed,
        totalViews,
        totalClicks,
        conversionRate: totalViews > 0 ? Math.round((totalClicks / totalViews) * 100) : 0,
      },
      offers,
      recentRedemptions: redemptions.slice(0, 10),
    };
  },

  async getOfferAnalytics(offerId: string, vendorId: string) {
    const offer = await prisma.vendorOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new ApiError(404, 'Offer not found');
    if (offer.vendorId !== vendorId) throw new ApiError(403, 'Not your offer');

    const [dailyRedemptions, totalRedemptions] = await Promise.all([
      prisma.redemption.groupBy({
        by: ['createdAt'],
        where: { offerId, status: 'VERIFIED' },
        _count: { id: true },
        _sum: { pointsSpent: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.redemption.findMany({
        where: { offerId },
        select: { status: true, pointsSpent: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      offer: {
        id: offer.id,
        title: offer.title,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        pointsRequired: offer.pointsRequired,
        isApproved: offer.isApproved,
        isActive: offer.isActive,
        currentRedemptions: offer.currentRedemptions,
        maxRedemptions: offer.maxRedemptions,
        viewCount: offer.viewCount,
        clickCount: offer.clickCount,
        createdAt: offer.createdAt,
      },
      redemptions: {
        total: totalRedemptions.length,
        verified: totalRedemptions.filter(r => r.status === 'VERIFIED').length,
        cancelled: totalRedemptions.filter(r => r.status === 'CANCELLED').length,
        totalPointsSpent: totalRedemptions.filter(r => r.status === 'VERIFIED').reduce((s, r) => s + r.pointsSpent, 0),
      },
      dailyTrend: dailyRedemptions.map(d => ({
        date: d.createdAt.toISOString().split('T')[0],
        count: d._count.id,
        points: d._sum.pointsSpent || 0,
      })),
    };
  },

  async getAnalytics(vendorId: string, period: '7d' | '30d' | '90d' = '7d') {
    const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [offers, redemptions, dailyStats] = await Promise.all([
      prisma.vendorOffer.findMany({
        where: { vendorId },
        select: { id: true, title: true, viewCount: true, clickCount: true, currentRedemptions: true, discountValue: true },
      }),
      prisma.redemption.findMany({
        where: { vendorId, createdAt: { gte: since } },
        select: { id: true, status: true, pointsSpent: true, discountValue: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.redemption.groupBy({
        by: ['createdAt'],
        where: { vendorId, createdAt: { gte: since } },
        _count: { id: true },
        _sum: { pointsSpent: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const verified = redemptions.filter(r => r.status === 'VERIFIED');
    const totalViews = offers.reduce((s, o) => s + o.viewCount, 0);
    const totalClicks = offers.reduce((s, o) => s + o.clickCount, 0);
    const popularOffers = [...offers].sort((a, b) => b.currentRedemptions - a.currentRedemptions).slice(0, 5);

    return {
      period,
      overview: {
        totalViews,
        totalClicks,
        totalRedemptions: redemptions.length,
        verifiedRedemptions: verified.length,
        totalPointsRedeemed: verified.reduce((s, r) => s + r.pointsSpent, 0),
        revenueImpact: verified.reduce((s, r) => s + r.discountValue, 0),
        uniqueCustomers: new Set(redemptions.map(r => r.id)).size,
      },
      popularOffers: popularOffers.map(o => ({
        id: o.id, title: o.title, views: o.viewCount, clicks: o.clickCount, redemptions: o.currentRedemptions,
      })),
      dailyTrend: dailyStats.map(d => ({
        date: d.createdAt.toISOString().split('T')[0],
        count: d._count.id,
        points: d._sum.pointsSpent || 0,
      })),
    };
  },
};
