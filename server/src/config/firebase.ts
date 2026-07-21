import fs from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { env } from './env';
import { logger } from './logger';

let messagingInstance: Messaging | null = null;

function loadFirebasePrivateKey(): string | undefined {
  if (env.firebase.privateKeyPath) {
    try {
      return fs.readFileSync(env.firebase.privateKeyPath, 'utf8');
    } catch (err) {
      logger.error({ err, path: env.firebase.privateKeyPath }, 'Failed to read Firebase private key file');
    }
  }
  if (env.firebase.privateKey) {
    return env.firebase.privateKey.replace(/\\n/g, '\n');
  }
  return undefined;
}

export function initFirebase(): void {
  const { projectId, clientEmail, storageBucket } = env.firebase;
  const privateKey = loadFirebasePrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    logger.warn('Firebase credentials not configured. Push notifications will be disabled.');
    return;
  }

  if (getApps().length > 0) {
    logger.info('Firebase Admin SDK already initialized');
    messagingInstance = getMessaging();
    return;
  }

  try {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: storageBucket || undefined,
    });
    messagingInstance = getMessaging();
    logger.info('Firebase Admin SDK initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Firebase Admin SDK');
  }
}

export function getMessagingInstance(): Messaging | null {
  return messagingInstance;
}

export function isFirebaseReady(): boolean {
  return messagingInstance !== null;
}
