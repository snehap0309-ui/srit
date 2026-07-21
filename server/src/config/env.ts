import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const isProduction = process.env.NODE_ENV === 'production';

function requireClientUrl(): string {
  throw new Error('CLIENT_URL environment variable is required in production');
}

export const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwt: {
    secret: process.env.JWT_SECRET,
    // Short-lived access tokens; clients refresh via /auth/refresh. Override with JWT_EXPIRES_IN if needed.
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    privateKeyPath: process.env.FIREBASE_PRIVATE_KEY_PATH || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  },
  sentryDsn: process.env.SENTRY_DSN || '',
  clientUrl: process.env.CLIENT_URL || (isProduction ? requireClientUrl() : 'http://localhost:3000'),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  googlePlay: {
    packageName: process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.palsafar.app',
    serviceAccountJson: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '',
  },
  appleIap: {
    issuerId: process.env.APPLE_IAP_ISSUER_ID || '',
    keyId: process.env.APPLE_IAP_KEY_ID || '',
    privateKey: process.env.APPLE_IAP_PRIVATE_KEY || '',
    bundleId: process.env.APPLE_IAP_BUNDLE_ID || '',
    env: process.env.APPLE_IAP_ENV || 'production',
  },
  isProduction,
};
