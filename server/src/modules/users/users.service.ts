import { CreatorStatus, Prisma, Role, RoleAssignmentStatus, VendorStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../shared/utils/ApiError';
import { getPaginationParams, paginatedResponse } from '../../shared/utils/pagination';
import { UpdateRoleInput } from './users.validation';
import { eventBus, AppEvents } from '../../config/events';
import {
  enrichUserWithRoles,
  ensureBaseUserRole,
  upsertRoleStatus,
} from '../../shared/utils/specialtyRoles';
import { roleTransitionService, type ProfessionalRole } from '../../shared/services/roleTransition.service';

/** Vendor/creator statuses that still need admin attention in the users list. */
const ATTENTION_VENDOR_STATUSES: VendorStatus[] = [
  VendorStatus.PENDING,
  VendorStatus.CHANGES_REQUESTED,
];
const ATTENTION_CREATOR_STATUSES: CreatorStatus[] = [
  CreatorStatus.PENDING,
  CreatorStatus.CHANGES_REQUESTED,
];

const roleAttentionFilter: Prisma.UserWhereInput = {
  OR: [
    { vendor: { is: { status: { in: ATTENTION_VENDOR_STATUSES } } } },
    { creatorProfile: { is: { status: { in: ATTENTION_CREATOR_STATUSES } } } },
  ],
};

const vendorListSelect = {
  id: true,
  businessName: true,
  status: true,
} satisfies Prisma.VendorSelect;

const creatorListSelect = {
  id: true,
  fullName: true,
  username: true,
  status: true,
} satisfies Prisma.CreatorProfileSelect;

/** Full application payload for admin user detail / role review. */
const vendorDetailSelect = {
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
  gstNumber: true,
  documents: true,
  status: true,
  rejectionReason: true,
  vendorCode: true,
  linkedSpotIds: true,
  services: true,
  createdAt: true,
  updatedAt: true,
  reviewedAt: true,
} satisfies Prisma.VendorSelect;

const creatorDetailSelect = {
  id: true,
  username: true,
  fullName: true,
  bio: true,
  avatar: true,
  travelCategories: true,
  instagramUrl: true,
  youtubeUrl: true,
  facebookUrl: true,
  languages: true,
  governmentIdUrl: true,
  portfolioLinks: true,
  sampleReelUrl: true,
  applicationReason: true,
  status: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CreatorProfileSelect;

const userSelect = {
  id: true,
  email: true,
  name: true,
  permission: true,
  activeMode: true,
  verificationStatus: true,
  createdAt: true,
  updatedAt: true,
  vendor: { select: vendorListSelect },
  creatorProfile: { select: creatorListSelect },
} satisfies Prisma.UserSelect;

const userDetailSelect = {
  ...userSelect,
  pointBalance: true,
  wallet: true,
  vendor: { select: vendorDetailSelect },
  creatorProfile: { select: creatorDetailSelect },
} satisfies Prisma.UserSelect;

export const usersService = {
  async list(query: { page?: string; limit?: string; search?: string; permission?: string; role?: string }) {
    const pagination = getPaginationParams(query);
    const where: Prisma.UserWhereInput = {};

    if (query.permission ?? query.role) {
      const role = (query.permission ?? query.role) as Role;
      where.OR = [
        { permission: role },
        { userRoles: { some: { role, status: { in: [RoleAssignmentStatus.ACTIVE, RoleAssignmentStatus.APPROVED] } } } },
      ];
    }

    if (query.search) {
      const searchClause = [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { email: { contains: query.search, mode: 'insensitive' as const } },
      ];
      where.AND = [{ OR: searchClause }, ...(where.OR ? [{ OR: where.OR }] : [])];
      delete where.OR;
    }

    // Pending / changes-requested role apps first so the queue stays actionable;
    // already-approved (and other settled) users sort below.
    const attentionWhere: Prisma.UserWhereInput = { AND: [where, roleAttentionFilter] };
    const settledWhere: Prisma.UserWhereInput = { AND: [where, { NOT: roleAttentionFilter }] };

    const [attentionTotal, settledTotal] = await Promise.all([
      prisma.user.count({ where: attentionWhere }),
      prisma.user.count({ where: settledWhere }),
    ]);
    const total = attentionTotal + settledTotal;
    const { skip, limit } = pagination;

    let data: Prisma.UserGetPayload<{ select: typeof userSelect }>[] = [];
    if (skip < attentionTotal) {
      const attentionTake = Math.min(limit, attentionTotal - skip);
      const attentionRows = await prisma.user.findMany({
        select: userSelect,
        where: attentionWhere,
        skip,
        take: attentionTake,
        orderBy: { createdAt: 'desc' },
      });
      data = attentionRows;
      const remaining = limit - attentionRows.length;
      if (remaining > 0) {
        const settledRows = await prisma.user.findMany({
          select: userSelect,
          where: settledWhere,
          skip: 0,
          take: remaining,
          orderBy: { createdAt: 'desc' },
        });
        data = [...data, ...settledRows];
      }
    } else {
      data = await prisma.user.findMany({
        select: userSelect,
        where: settledWhere,
        skip: skip - attentionTotal,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    }

    return paginatedResponse(
      await Promise.all(data.map((u) => enrichUserWithRoles(u))),
      total,
      pagination,
    );
  },

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      select: userDetailSelect,
      where: { id },
    });
    if (!user) {
      throw new ApiError(404, 'User not found.');
    }
    return enrichUserWithRoles(user);
  },

  async updateRole(id: string, input: UpdateRoleInput, actorId: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        permission: true,
        activeMode: true,
        email: true,
        name: true,
        vendor: { select: { id: true } },
        creatorProfile: { select: { id: true } },
      },
    });
    if (!user) {
      throw new ApiError(404, 'User not found.');
    }

    const previous = { permission: user.permission, activeMode: user.activeMode };
    const newPermission = input.permission as Role;

    if (newPermission === Role.USER) {
      // Demotion to plain USER retires any held professional roles via the central service.
      await roleTransitionService.demoteToUser(id, actorId);
    } else if (newPermission === Role.ADMIN) {
      await ensureBaseUserRole(id);
      await upsertRoleStatus({
        userId: id,
        role: Role.ADMIN,
        status: RoleAssignmentStatus.APPROVED,
        approvedById: actorId,
      });
      await prisma.user.update({
        where: { id },
        data: { permission: Role.ADMIN, activeMode: Role.ADMIN },
      });
    } else {
      // Professional roles are exclusive — all grant logic lives in the central transition service.
      await roleTransitionService.adminGrant(
        id,
        newPermission as ProfessionalRole,
        actorId,
        input.confirmSwitch,
      );
    }

    const updated = await prisma.user.findUniqueOrThrow({
      select: userSelect,
      where: { id },
    });

    eventBus.emit(AppEvents.USER_ROLE_CHANGED, {
      userId: id,
      actorId,
      previous,
      newValues: { permission: updated.permission, activeMode: updated.activeMode },
    });

    return enrichUserWithRoles(updated);
  },

  async delete(id: string, actorId: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, permission: true, activeMode: true },
    });
    if (!user) {
      throw new ApiError(404, 'User not found.');
    }

    if (actorId === id) {
      throw new ApiError(400, 'You cannot delete your own account.');
    }

    const previous = { name: user.name, email: user.email, permission: user.permission, activeMode: user.activeMode };

    await prisma.user.delete({ where: { id } });

    eventBus.emit(AppEvents.USER_ROLE_CHANGED, { userId: id, actorId, previous, newValues: {} });

    return { message: 'User deleted successfully' };
  },
};
