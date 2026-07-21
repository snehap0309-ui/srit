import { prisma } from '../../config/database';
import { ApiError } from '../../shared/utils/ApiError';
import { DEFAULT_POINT_RULES, DEPRECATED_POINT_RULE_KEYS } from './pointRules.validation';

export const pointRulesService = {
  async listRules() {
    return prisma.pointRule.findMany({ orderBy: { createdAt: 'asc' } });
  },

  async getRuleByKey(key: string) {
    const rule = await prisma.pointRule.findUnique({ where: { key } });
    if (!rule) throw new ApiError(404, `Point rule '${key}' not found`);
    return rule;
  },

  async createRule(input: {
    key: string;
    label: string;
    description?: string;
    points: number;
    category?: string;
    isActive?: boolean;
    cooldownSec?: number;
    maxDaily?: number;
  }) {
    const existing = await prisma.pointRule.findUnique({ where: { key: input.key } });
    if (existing) throw new ApiError(409, `Point rule with key '${input.key}' already exists`);

    return prisma.pointRule.create({ data: input });
  },

  async updateRule(id: string, input: Partial<{
    key: string;
    label: string;
    description: string;
    points: number;
    category: string;
    isActive: boolean;
    cooldownSec: number;
    maxDaily: number;
  }>) {
    const existing = await prisma.pointRule.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Point rule not found');

    if (input.key && input.key !== existing.key) {
      const conflict = await prisma.pointRule.findUnique({ where: { key: input.key } });
      if (conflict) throw new ApiError(409, `Point rule with key '${input.key}' already exists`);
    }

    return prisma.pointRule.update({ where: { id }, data: input });
  },

  async deleteRule(id: string) {
    const existing = await prisma.pointRule.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Point rule not found');

    await prisma.pointRule.delete({ where: { id } });
  },

  async seedDefaults() {
    for (const rule of DEFAULT_POINT_RULES) {
      await prisma.pointRule.upsert({
        where: { key: rule.key },
        update: {
          label: rule.label,
          description: rule.description,
          points: rule.points,
          category: rule.category,
          cooldownSec: rule.cooldownSec,
          maxDaily: rule.maxDaily ?? null,
          isActive: true,
        },
        create: { ...rule, isActive: true },
      });
    }

    // Remove wishlist rules that have no award path in code
    await prisma.pointRule.deleteMany({
      where: { key: { in: [...DEPRECATED_POINT_RULE_KEYS] } },
    });
  },

  async getPointsForAction(key: string) {
    const rule = await prisma.pointRule.findUnique({ where: { key } });
    if (!rule || !rule.isActive) return null;
    return { points: rule.points };
  },

  async checkCooldown(userId: string, key: string) {
    const rule = await prisma.pointRule.findUnique({ where: { key } });
    if (!rule || !rule.cooldownSec || rule.cooldownSec <= 0) return false;

    const since = new Date(Date.now() - rule.cooldownSec * 1000);

    const recent = await prisma.walletTransaction.findFirst({
      where: {
        userId,
        reason: key,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });

    return !!recent;
  },

  async checkDailyLimit(userId: string, key: string) {
    const rule = await prisma.pointRule.findUnique({ where: { key } });
    if (!rule || !rule.maxDaily || rule.maxDaily <= 0) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.walletTransaction.count({
      where: {
        userId,
        reason: key,
        createdAt: { gte: today },
      },
    });

    return count >= rule.maxDaily;
  },
};
