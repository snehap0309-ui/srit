import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import {
  getMessaging,
  getToken,
  getInitialNotification,
  onMessage,
  onNotificationOpenedApp as subscribeNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
  hasPermission,
  registerDeviceForRemoteMessages,
  AuthorizationStatus,
  type Messaging,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { notificationsApi } from './api';

let messagingInstance: Messaging | null | undefined;
let lastRegisteredToken: string | null = null;
let refreshUnsubscribe: (() => void) | null = null;

function messagingOrNull(): Messaging | null {
  if (messagingInstance !== undefined) return messagingInstance;
  try {
    if (typeof getMessaging !== 'function') {
      messagingInstance = null;
      return null;
    }
    messagingInstance = getMessaging();
  } catch {
    messagingInstance = null;
  }
  return messagingInstance;
}

async function requestAndroidPostNotifications(): Promise<'granted' | 'denied' | 'blocked'> {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return 'granted';
  }
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
    return 'denied';
  } catch {
    return 'denied';
  }
}

async function syncTokenToServer(token: string, retries = 3): Promise<void> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < retries) {
    try {
      await notificationsApi.registerToken({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown',
      });
      lastRegisteredToken = token;
      return;
    } catch (err) {
      lastError = err;
      attempt += 1;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  console.warn('[notificationService] Token sync failed after retries:', lastError);
}

export const notificationService = {
  async getNotifications(page = 1, limit = 20) {
    try {
      const res = await notificationsApi.list(page, limit);
      return res.notifications || (res as any).data?.notifications || [];
    } catch (err) {
      console.warn('[notificationService] getNotifications failed:', err);
      return [];
    }
  },

  async markAsRead(notificationId: string): Promise<void> {
    try {
      await notificationsApi.markRead([notificationId]);
    } catch (err) {
      console.warn('[notificationService] markAsRead failed:', err);
    }
  },

  async markAllAsRead(): Promise<void> {
    try {
      await notificationsApi.markAllRead();
    } catch (err) {
      console.warn('[notificationService] markAllAsRead failed:', err);
    }
  },

  async requestPermission(offerSettingsOnBlocked = false): Promise<boolean> {
    const messaging = messagingOrNull();
    if (!messaging) return false;

    if (Platform.OS === 'android') {
      const androidStatus = await requestAndroidPostNotifications();
      if (androidStatus === 'blocked') {
        if (offerSettingsOnBlocked) {
          Alert.alert(
            'Notifications blocked',
            'Enable notifications in system settings to receive trip and reward alerts.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
        }
        return false;
      }
      if (androidStatus === 'denied') {
        return false;
      }
    }

    if (typeof requestPermission !== 'function') return false;
    const authStatus = await requestPermission(messaging);
    return (
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL
    );
  },

  /** Re-request permission or open Settings if permanently denied (Android 13+). */
  async retryPermissionFlow(): Promise<boolean> {
    const granted = await this.isPermissionGranted();
    if (granted) return true;
    return this.requestPermission(true);
  },

  async getFCMToken(): Promise<string | null> {
    const messaging = messagingOrNull();
    if (!messaging) return null;
    try {
      if (typeof registerDeviceForRemoteMessages === 'function') {
        await registerDeviceForRemoteMessages(messaging);
      }
      if (typeof getToken !== 'function') return null;
      const token = await getToken(messaging);
      return token || null;
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      // Placeholder google-services.json has no real API key — skip noisy stack traces in local/dev builds.
      if (/valid API key|api.?key/i.test(msg)) {
        if (__DEV__) {
          console.warn('[notificationService] FCM skipped: Firebase API key not configured');
        }
        return null;
      }
      console.warn('[notificationService] getFCMToken failed:', err);
      return null;
    }
  },

  async registerDeviceToken(): Promise<void> {
    const messaging = messagingOrNull();
    if (!messaging) return;

    const granted = await this.isPermissionGranted();
    if (!granted) {
      const ok = await this.requestPermission();
      if (!ok) return;
    }

    const token = await this.getFCMToken();
    if (!token) return;

    await syncTokenToServer(token);

    if (!refreshUnsubscribe && typeof onTokenRefresh === 'function') {
      refreshUnsubscribe = onTokenRefresh(messaging, async (newToken) => {
        if (!newToken || newToken === lastRegisteredToken) return;
        await syncTokenToServer(newToken);
      });
    }
  },

  async unregisterDeviceToken(): Promise<void> {
    const token = lastRegisteredToken || (await this.getFCMToken());
    if (!token) return;
    try {
      await notificationsApi.unregisterToken(token);
    } catch (err) {
      console.warn('[notificationService] unregisterDeviceToken failed:', err);
    } finally {
      lastRegisteredToken = null;
      if (refreshUnsubscribe) {
        refreshUnsubscribe();
        refreshUnsubscribe = null;
      }
    }
  },

  async isPermissionGranted(): Promise<boolean> {
    const messaging = messagingOrNull();
    if (!messaging) return false;

    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const has = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (!has) return false;
    }

    if (typeof hasPermission !== 'function') return false;
    const status = await hasPermission(messaging);
    return (
      status === AuthorizationStatus.AUTHORIZED ||
      status === AuthorizationStatus.PROVISIONAL
    );
  },

  /** Prompt user to open Settings after permanent denial. */
  async openSystemSettings(): Promise<void> {
    await Linking.openSettings();
  },

  async setupForegroundHandler(): Promise<(() => void) | null> {
    const messaging = messagingOrNull();
    if (!messaging || typeof onMessage !== 'function') return null;

    return onMessage(messaging, async (remoteMessage: RemoteMessage) => {
      const title = remoteMessage.notification?.title || remoteMessage.data?.title;
      const body = remoteMessage.notification?.body || remoteMessage.data?.body;
      if (title || body) {
        Alert.alert(String(title || 'PalSafar'), String(body || ''));
      }
    });
  },

  async onNotificationOpenedApp(
    handler: (remoteMessage: RemoteMessage) => void,
  ): Promise<(() => void) | null> {
    const messaging = messagingOrNull();
    if (!messaging || typeof subscribeNotificationOpenedApp !== 'function') return null;
    return subscribeNotificationOpenedApp(messaging, handler);
  },

  async checkInitialNotification(): Promise<RemoteMessage | null> {
    const messaging = messagingOrNull();
    if (!messaging || typeof getInitialNotification !== 'function') return null;
    try {
      return await getInitialNotification(messaging);
    } catch {
      return null;
    }
  },
};
