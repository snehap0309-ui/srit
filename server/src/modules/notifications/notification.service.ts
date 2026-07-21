import { type MulticastMessage } from 'firebase-admin/messaging';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { getMessagingInstance, isFirebaseReady } from '../../config/firebase';
import { ApiError } from '../../shared/utils/ApiError';

export const notificationService = {
  async registerDeviceToken(userId: string, token: string, platform: string = 'unknown') {
    const existing = await prisma.deviceToken.findUnique({ where: { token } });
    if (existing) {
      if (existing.userId !== userId) {
        await prisma.deviceToken.update({
          where: { token },
          data: { userId, platform },
        });
      } else if (existing.platform !== platform) {
        await prisma.deviceToken.update({
          where: { token },
          data: { platform },
        });
      }
      return existing;
    }

    return prisma.deviceToken.create({
      data: { userId, token, platform },
    });
  },

  async unregisterDeviceToken(userId: string, token: string) {
    const existing = await prisma.deviceToken.findUnique({ where: { token } });
    if (!existing) return null;
    if (existing.userId !== userId) {
      throw new ApiError(403, 'Token does not belong to this user');
    }
    return prisma.deviceToken.delete({ where: { token } });
  },

  async unregisterAllUserTokens(userId: string) {
    return prisma.deviceToken.deleteMany({ where: { userId } });
  },

  async sendToUser(userId: string, title: string, body?: string, data?: Record<string, unknown>, type: string = 'system') {
    const tokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true, platform: true },
    });

    if (tokens.length === 0) {
      logger.debug({ userId, title }, 'No device tokens found for user');
    }

    const notification = await prisma.inAppNotification.create({
      data: {
        userId,
        type,
        title,
        body: body || null,
        data: data ? JSON.parse(JSON.stringify(data)) : undefined,
      },
    });

    if (tokens.length > 0) {
      this.sendPushToTokens(
        tokens.map((t) => t.token),
        title,
        body,
        data,
      ).catch((err) => {
        logger.error({ err, userId }, 'Failed to send push notification');
      });
    }

    return notification;
  },

  async sendToMultipleUsers(userIds: string[], title: string, body?: string, data?: Record<string, unknown>, type: string = 'system') {
    const tokens = await prisma.deviceToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true, userId: true },
    });

    if (tokens.length === 0) {
      logger.debug({ userIdCount: userIds.length, title }, 'No device tokens found for users');
    }

    await prisma.inAppNotification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title,
        body: body || null,
        data: (data || undefined) as any,
      })),
    });

    if (tokens.length > 0) {
      this.sendPushToTokens(
        tokens.map((t) => t.token),
        title,
        body,
        data,
      ).catch((err) => {
        logger.error({ err, userIdCount: userIds.length }, 'Failed to send bulk push notification');
      });
    }
  },

  async sendToAll(title: string, body?: string, data?: Record<string, unknown>, type: string = 'admin') {
    const users = await prisma.user.findMany({
      select: { id: true },
    });

    const userIds = users.map((u) => u.id);

    await prisma.inAppNotification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title,
        body: body || null,
        data: (data || undefined) as any,
      })),
    });

    const tokens = await prisma.deviceToken.findMany({
      select: { token: true },
    });

    if (tokens.length > 0) {
      this.sendPushToTokens(
        tokens.map((t) => t.token),
        title,
        body,
        data,
      ).catch((err) => {
        logger.error({ err }, 'Failed to send broadcast push notification');
      });
    }
  },

  async sendPushToTokens(tokens: string[], title: string, body?: string, data?: Record<string, unknown>) {
    if (!isFirebaseReady() || tokens.length === 0) return;

    const messaging = getMessagingInstance();
    if (!messaging) return;

    const message: MulticastMessage = {
      tokens,
      notification: {
        title,
        body: body || undefined,
      },
      data: data ? Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)]),
      ) : undefined,
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);

    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp: { success: boolean; error?: any }, idx: number) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          logger.warn({ error: resp.error, token: '[REDACTED]' }, 'FCM send failed');
        }
      });

      if (failedTokens.length > 0) {
        await prisma.deviceToken.deleteMany({
          where: { token: { in: failedTokens } },
        });
        logger.info({ removedCount: failedTokens.length }, 'Removed invalid device tokens');
      }
    }

    return response;
  },

  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.inAppNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inAppNotification.count({ where: { userId } }),
    ]);

    const unreadCount = await prisma.inAppNotification.count({
      where: { userId, read: false },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      unreadCount,
    };
  },

  async markAsRead(userId: string, notificationIds: string[]) {
    await prisma.inAppNotification.updateMany({
      where: { id: { in: notificationIds }, userId },
      data: { read: true },
    });
  },

  async markAllAsRead(userId: string) {
    await prisma.inAppNotification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  },

  // ── Admin: Send targeted notifications ──
  async sendToRole(role: string, title: string, body?: string, data?: Record<string, unknown>, type: string = 'admin') {
    const users = await prisma.user.findMany({
      where: { permission: role as any },
      select: { id: true },
    });
    const userIds = users.map(u => u.id);
    if (userIds.length === 0) return;

    await prisma.inAppNotification.createMany({
      data: userIds.map(userId => ({
        userId, type, title,
        body: body || null,
        data: (data || undefined) as any,
      })),
    });

    const tokens = await prisma.deviceToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });

    if (tokens.length > 0) {
      this.sendPushToTokens(tokens.map(t => t.token), title, body, data).catch((err) => {
        logger.error({ err }, 'Failed to send state push notification');
      });
    }
  },

  async sendToCity(city: string, title: string, body?: string, data?: Record<string, unknown>, type: string = 'admin') {
    const users = await prisma.user.findMany({
      where: {
        checkIns: { some: { place: { city } } },
      },
      select: { id: true },
    });
    const userIds = [...new Set(users.map(u => u.id))];
    if (userIds.length === 0) return;

    await prisma.inAppNotification.createMany({
      data: userIds.map(userId => ({
        userId, type, title,
        body: body || null,
        data: (data || undefined) as any,
      })),
    });

    const tokens = await prisma.deviceToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });

    if (tokens.length > 0) {
      this.sendPushToTokens(tokens.map(t => t.token), title, body, data).catch((err) => {
        logger.error({ err }, 'Failed to send city push notification');
      });
    }
  },

  async sendToCategory(category: string, title: string, body?: string, data?: Record<string, unknown>, type: string = 'admin') {
    const users = await prisma.user.findMany({
      where: {
        checkIns: { some: { place: { category } } },
      },
      select: { id: true },
    });
    const userIds = [...new Set(users.map(u => u.id))];
    if (userIds.length === 0) return;

    await prisma.inAppNotification.createMany({
      data: userIds.map(userId => ({
        userId, type, title,
        body: body || null,
        data: (data || undefined) as any,
      })),
    });

    const tokens = await prisma.deviceToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });

    if (tokens.length > 0) {
      this.sendPushToTokens(tokens.map(t => t.token), title, body, data).catch((err) => {
        logger.error({ err }, 'Failed to send category push notification');
      });
    }
  },

  // ── Notification Templates ──
  async listTemplates() {
    return prisma.notificationTemplate.findMany({ orderBy: { name: 'asc' } });
  },

  async createTemplate(input: { name: string; title: string; body?: string; type?: string; category?: string; variables?: string[] }) {
    return prisma.notificationTemplate.create({
      data: {
        name: input.name,
        title: input.title,
        body: input.body || null,
        type: input.type || 'system',
        category: input.category || 'general',
        variables: input.variables || [],
      },
    });
  },

  async updateTemplate(id: string, input: Partial<{ name: string; title: string; body: string; type: string; category: string; variables: string[] }>) {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.title !== undefined) data.title = input.title;
    if (input.body !== undefined) data.body = input.body;
    if (input.type !== undefined) data.type = input.type;
    if (input.category !== undefined) data.category = input.category;
    if (input.variables !== undefined) data.variables = input.variables;
    return prisma.notificationTemplate.update({ where: { id }, data });
  },

  async deleteTemplate(id: string) {
    return prisma.notificationTemplate.delete({ where: { id } });
  },

  async sendFromTemplate(templateId: string, target: { type: 'all' | 'role' | 'city' | 'category' | 'user'; value?: string }, variables?: Record<string, string>) {
    const template = await prisma.notificationTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new ApiError(404, 'Template not found');

    let title = template.title;
    let body = template.body || '';

    if (variables) {
      for (const [key, val] of Object.entries(variables)) {
        title = title.replace(`{{${key}}}`, val);
        body = body.replace(`{{${key}}}`, val);
      }
    }

    const notifData = { templateId: template.id };

    switch (target.type) {
      case 'all':
        await this.sendToAll(title, body, notifData, template.type);
        break;
      case 'role':
        await this.sendToRole(target.value || 'USER', title, body, notifData, template.type);
        break;
      case 'user':
        if (target.value) await this.sendToUser(target.value, title, body, notifData, template.type);
        break;
      case 'city':
        await this.sendToCity(target.value || '', title, body, notifData, template.type);
        break;
      case 'category':
        await this.sendToCategory(target.value || '', title, body, notifData, template.type);
        break;
    }
  },

  async listAdminNotifications(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.inAppNotification.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.inAppNotification.count(),
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
};
