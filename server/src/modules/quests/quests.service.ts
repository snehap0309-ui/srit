import { prisma } from '../../config/database';
import { ApiError } from '../../shared/utils/ApiError';
import { pointRulesService } from '../point-rules/pointRules.service';

export const questsService = {
  async list(query: { page?: string; limit?: string; isActive?: string; search?: string; city?: string; difficulty?: string }) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;
    const where: any = {};

    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };
    if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
    if (query.difficulty) where.difficulty = query.difficulty;

    const [data, total] = await Promise.all([
      prisma.quest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { completions: true, checkpointCompletions: true } } },
      }),
      prisma.quest.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  },

  async getById(id: string) {
    const quest = await prisma.quest.findUnique({
      where: { id },
      include: { _count: { select: { completions: true } } },
    });
    if (!quest) throw new ApiError(404, 'Quest not found');
    return quest;
  },

  async create(data: {
    title: string;
    description?: string;
    type?: string;
    rewardPoints?: number;
    placeIds?: string[];
    checkpoints?: any[];
    image?: string;
    city?: string;
    difficulty?: string;
    estimatedTime?: string;
    startsAt: string;
    endsAt?: string;
  }) {
    return prisma.quest.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type || 'scavenger_hunt',
        rewardPoints: data.rewardPoints || 0,
        placeIds: data.placeIds || [],
        checkpoints: data.checkpoints || [],
        image: data.image,
        city: data.city,
        difficulty: data.difficulty || 'medium',
        estimatedTime: data.estimatedTime,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    });
  },

  async update(id: string, data: {
    title?: string;
    description?: string;
    type?: string;
    rewardPoints?: number;
    placeIds?: string[];
    checkpoints?: any[];
    image?: string;
    city?: string;
    difficulty?: string;
    estimatedTime?: string;
    startsAt?: string;
    endsAt?: string | null;
    isActive?: boolean;
  }) {
    const existing = await prisma.quest.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Quest not found');

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.rewardPoints !== undefined) updateData.rewardPoints = data.rewardPoints;
    if (data.placeIds !== undefined) updateData.placeIds = data.placeIds;
    if (data.checkpoints !== undefined) updateData.checkpoints = data.checkpoints;
    if (data.image !== undefined) updateData.image = data.image;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
    if (data.estimatedTime !== undefined) updateData.estimatedTime = data.estimatedTime;
    if (data.startsAt !== undefined) updateData.startsAt = new Date(data.startsAt);
    if (data.endsAt !== undefined) updateData.endsAt = data.endsAt ? new Date(data.endsAt) : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.quest.update({ where: { id }, data: updateData });
  },

  async delete(id: string) {
    const existing = await prisma.quest.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Quest not found');
    await prisma.quest.delete({ where: { id } });
  },

  async getCompletions(questId: string, query: { page?: string; limit?: string }) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.questCompletion.findMany({
        where: { questId },
        skip,
        take: limit,
        orderBy: { completedAt: 'desc' },
        include: { quest: { select: { title: true } } },
      }),
      prisma.questCompletion.count({ where: { questId } }),
    ]);

    return {
      data,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  },

  async complete(questId: string, userId: string) {
    const quest = await prisma.quest.findUnique({ where: { id: questId } });
    if (!quest) throw new ApiError(404, 'Quest not found');
    if (!quest.isActive) throw new ApiError(400, 'Quest is not active');

    const existing = await prisma.questCompletion.findUnique({
      where: { questId_userId: { questId, userId } },
    });
    if (existing) throw new ApiError(409, 'Quest already completed');

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new ApiError(404, 'Wallet not found');

    const rule = await pointRulesService.getPointsForAction('quest');
    const pointsAwarded =
      quest.rewardPoints && quest.rewardPoints > 0
        ? quest.rewardPoints
        : (rule?.points ?? 0);

    if (pointsAwarded <= 0) {
      const completion = await prisma.questCompletion.create({
        data: { questId, userId },
      });
      return completion;
    }

    const [completion] = await prisma.$transaction([
      prisma.questCompletion.create({
        data: { questId, userId },
      }),
      prisma.wallet.update({
        where: { userId },
        data: {
          palPoints: { increment: pointsAwarded },
          lifetimeEarned: { increment: pointsAwarded },
        },
      }),
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'EARN',
          amount: pointsAwarded,
          reason: 'quest',
          referenceId: questId,
          referenceType: 'QUEST',
        },
      }),
    ]);

    return completion;
  },

  // ----- Checkpoint-level tracking -----

  async getMyProgress(questId: string, userId: string) {
    const quest = await prisma.quest.findUnique({ where: { id: questId } });
    if (!quest) throw new ApiError(404, 'Quest not found');

    const completed = await prisma.questCheckpointCompletion.findMany({
      where: { questId, userId },
      select: { checkpointId: true, completedAt: true, photoProofUrl: true },
    });

    const fullCompletion = await prisma.questCompletion.findUnique({
      where: { questId_userId: { questId, userId } },
    });

    return {
      questId,
      completedCheckpoints: completed,
      isQuestCompleted: !!fullCompletion,
      questCompletedAt: fullCompletion?.completedAt ?? null,
    };
  },

  async completeCheckpoint(questId: string, checkpointId: string, userId: string, photoProofUrl?: string) {
    const quest = await prisma.quest.findUnique({ where: { id: questId } });
    if (!quest) throw new ApiError(404, 'Quest not found');
    if (!quest.isActive) throw new ApiError(400, 'Quest is not active');

    // Upsert — idempotent
    const record = await prisma.questCheckpointCompletion.upsert({
      where: { questId_userId_checkpointId: { questId, userId, checkpointId } },
      create: { questId, userId, checkpointId, photoProofUrl: photoProofUrl || null },
      update: { photoProofUrl: photoProofUrl || undefined },
    });

    return record;
  },
};
