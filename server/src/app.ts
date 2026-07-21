import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import { prisma } from './config/database';
import { isFirebaseReady } from './config/firebase';
import { errorHandler } from './middleware/errorHandler';
import { globalLimiter } from './config/rateLimit';
import { httpLogger, correlationMiddleware } from './config/logger';
import { initSentry, getSentryRequestHandler, getSentryErrorHandler } from './config/sentry';
import { authenticate as authMiddleware } from './middleware/auth';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import placesRoutes, { adminRouter as adminPlacesRoutes, vendorRouter as vendorPlacesRoutes } from './modules/places/places.routes';
import uploadRoutes from './modules/upload/upload.routes';
import auditRoutes from './modules/audit/audit.routes';
import syncRoutes from './modules/sync/sync.routes';

import analyticsRoutes from './modules/analytics/analytics.routes';
import geospatialRoutes from './modules/geospatial/geospatial.routes';
import aiRoutes from './modules/ai/ai.routes';
import socialRoutes from './modules/social/social.routes';
import vendorsRoutes from './modules/vendors/vendors.routes';
import pointsRoutes from './modules/points/points.routes';
import redemptionsRoutes from './modules/redemptions/redemptions.routes';
import hiddenGemsRoutes, { adminRouter as adminHiddenGemsRoutes } from './modules/hidden-gems/hiddenGems.routes';
import notificationRoutes, { adminRouter as adminNotificationRoutes } from './modules/notifications/notification.routes';
import walletRoutes from './modules/wallet/wallet.routes';
import rewardsRoutes from './modules/rewards/rewards.routes';
import pointRulesRoutes from './modules/point-rules/pointRules.routes';
import growthAnalyticsRoutes from './modules/growth-analytics/growthAnalytics.routes';
import cityAnalyticsRoutes from './modules/city-analytics/cityAnalytics.routes';
import revenueAnalyticsRoutes from './modules/revenue-analytics/revenueAnalytics.routes';
import reportsRoutes from './modules/reports/reports.routes';
import settingsRoutes from './modules/settings/settings.routes';
import questsRoutes from './modules/quests/quests.routes';
import { campaignRoutes } from './modules/campaigns/campaigns.routes';
import challengesRoutes from './modules/challenges/challenges.routes';
import ridesRoutes from './modules/rides/rides.routes';
import tripsRoutes, { adminRouter as adminTripsRoutes } from './modules/trips/trips.routes';
import searchRoutes from './modules/search/search.routes';
import legalRoutes, { adminRouter as adminLegalRoutes } from './modules/legal/legal.routes';
import announcementsRoutes, { adminRouter as adminAnnouncementsRoutes } from './modules/announcements/announcements.routes';
import monetizationRoutes from './modules/monetization/monetization.routes';

const app = express();

app.set('trust proxy', 1);

initSentry();
app.use(getSentryRequestHandler());

const adminOrigins = [
  'https://pal-safar.vercel.app',
  'https://palsafar.vercel.app',
  'https://www.palsafar.vercel.app',
];

app.use(helmet({
  contentSecurityPolicy: env.isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc: ["'self'", env.clientUrl, ...adminOrigins],
    },
  } : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "http://localhost:*", "ws://localhost:*"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());

const allowedOrigins: string[] = [];

if (!env.isProduction) {
  allowedOrigins.push(
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://192.168.31.94:3000',
    'http://192.168.1.8:3000',
  );
}

if (env.clientUrl) {
  allowedOrigins.push(env.clientUrl);
}

adminOrigins.forEach(o => {
  if (!allowedOrigins.includes(o)) {
    allowedOrigins.push(o);
  }
});

app.use(cors({
  origin: (origin, callback) => {
    // Block null origin (prevents CSRF via sandboxed iframes)
    if (origin === 'null') {
      return callback(null, false);
    }
    if (!origin) {
      // Server-to-server requests (Postman, curl) — allow
      return callback(null, true);
    }
    if (!env.isProduction) {
      if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://192.168.')) {
        return callback(null, true);
      }
      return callback(null, false);
    }
    // Production: only explicitly allowed origins (no wildcard Vercel previews)
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(correlationMiddleware);
app.use(httpLogger);

app.use('/uploads', authMiddleware, express.static(path.join(__dirname, '../uploads')));

// Request timeout — AI itinerary generation needs longer than normal CRUD.
app.use((req, _res, next) => {
  const isUpload = req.path.startsWith('/api/v1/upload');
  const isAiTrip =
    req.path.includes('/trips/ai-generate')
    || (req.path.includes('/trips/') && req.path.endsWith('/generate'))
    || req.path.startsWith('/api/v1/ai/');
  req.setTimeout(isUpload || isAiTrip ? 120000 : 30000);
  next();
});

app.use('/api', globalLimiter);

app.get('/health', async (_req, res) => {
  let database: 'up' | 'down' = 'down';
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'up';
  } catch {
    database = 'down';
  }

  const cloudinaryConfigured = Boolean(
    env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret,
  );
  const firebaseConfigured = isFirebaseReady();
  const healthy = database === 'up';

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      database,
      cloudinary: cloudinaryConfigured ? 'configured' : 'missing',
      firebase: firebaseConfigured ? 'configured' : 'missing',
      redis: 'not_used',
    },
    message: healthy ? 'PalSafar API v1 is running' : 'PalSafar API degraded',
    meta: { uptime: process.uptime() },
  });
});

app.get('/metrics', (_req, res) => {
  res.json({
    success: true,
    data: {
      uptime: process.uptime(),
    },
  });
});

const apiV1 = express.Router();

apiV1.get('/health', (_req, res) => {
  res.json({ success: true, data: null, message: 'PalSafar API v1 is running', timestamp: new Date().toISOString() });
});

apiV1.use('/auth', authRoutes);
apiV1.use('/users', usersRoutes);
apiV1.use('/places', placesRoutes);
apiV1.use('/admin/places', adminPlacesRoutes);
apiV1.use('/vendor/places', vendorPlacesRoutes);
apiV1.use('/upload', uploadRoutes);
apiV1.use('/audit-logs', auditRoutes);
apiV1.use('/sync', syncRoutes);
apiV1.use('/analytics', analyticsRoutes);
apiV1.use('/geo', geospatialRoutes);
apiV1.use('/ai', aiRoutes);
apiV1.use('/social', socialRoutes);
apiV1.use('/vendors', vendorsRoutes);
apiV1.use('/points', pointsRoutes);
apiV1.use('/redemptions', redemptionsRoutes);
apiV1.use('/hidden-gems', hiddenGemsRoutes);
apiV1.use('/admin/hidden-gems', adminHiddenGemsRoutes);
apiV1.use('/notifications', notificationRoutes);
apiV1.use('/admin/notifications', adminNotificationRoutes);
apiV1.use('/wallet', walletRoutes);
apiV1.use('/rewards', rewardsRoutes);
apiV1.use('/point-rules', pointRulesRoutes);
apiV1.use('/analytics/growth', growthAnalyticsRoutes);
apiV1.use('/analytics/cities', cityAnalyticsRoutes);
apiV1.use('/analytics/revenue', revenueAnalyticsRoutes);
apiV1.use('/reports', reportsRoutes);
apiV1.use('/settings', settingsRoutes);
apiV1.use('/quests', questsRoutes);
apiV1.use('/campaigns', campaignRoutes);
apiV1.use('/challenges', challengesRoutes);
apiV1.use('/trips', tripsRoutes);
apiV1.use('/admin/trips', adminTripsRoutes);
apiV1.use('/rides', ridesRoutes);
apiV1.use('/search', searchRoutes);
apiV1.use('/legal', legalRoutes);
apiV1.use('/admin/legal', adminLegalRoutes);
apiV1.use('/announcements', announcementsRoutes);
apiV1.use('/admin/announcements', adminAnnouncementsRoutes);
apiV1.use('/monetization', monetizationRoutes);

app.use('/api/v1', apiV1);

if (env.isProduction) {
  // Swagger UI disabled in production to reduce attack surface
  app.get('/api-docs', (_req, res) => res.redirect('/'));
  app.get('/api-docs.json', (_req, res) => res.redirect('/'));
} else {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'PalSafar API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  }));

  app.get('/api-docs.json', (_req, res) => {
    res.json(swaggerSpec);
  });
}

app.all('*', (_req, res) => {
  res.status(404).json({ success: false, data: null, message: 'Route not found' });
});

app.use(getSentryErrorHandler());
app.use(errorHandler);

export default app;
