import React, { useEffect } from 'react';
import { Platform, UIManager } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const isNewArch = (global as any).nativeFabricUILibrary !== undefined || (global as any).RN$Bridgeless !== undefined;
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental && !isNewArch) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './src/context/ThemeContext';
import { UserProvider } from './src/context/UserContext';
import { DataProvider } from './src/context/DataContext';
import { LocationProvider } from './src/context/LocationContext';
import { EntitlementProvider } from './src/context/EntitlementContext';
import { RootNavigator } from './src/navigation';
import ErrorBoundary from './src/components/ErrorBoundary';
import { ToastProvider } from './src/context/ToastContext';
import { apiClient } from './src/services/api/client';
import { notificationService } from './src/services/notificationService';
import { syncService } from './src/services/syncService';
import { DEV_FLAGS } from './src/config/devFlags';
import { adsService } from './src/services/adsService';
function AppInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let foregroundUnsub: (() => void) | null = null;
    let openedAppUnsub: (() => void) | null = null;

    (async () => {
      try {
        if (DEV_FLAGS.USE_SERVER_API) {
          await apiClient.init();
          await syncService.init();
          syncService.sync();
        }
      } catch (err) {
        console.warn('[AppInitializer] API client/sync init failed:', err);
      }

      try {
        await adsService.refreshConfig();
        if (adsService.getConfig().showAds && !adsService.getConfig().killSwitch) {
          await adsService.init();
        }
      } catch (err) {
        console.warn('[AppInitializer] Ads init skipped:', err);
      }

      // Foreground notification handler
      try {
        foregroundUnsub = await (notificationService as any).setupForegroundHandler();
      } catch (err) {
        console.warn('[AppInitializer] Foreground handler setup failed:', err);
      }

      // Notification open: app was in background when user tapped
      try {
        openedAppUnsub = await (notificationService as any).onNotificationOpenedApp((remoteMessage: any) => {
          console.info('[Notification] Opened from background:', JSON.stringify(remoteMessage.data));
        });
      } catch (err) {
        console.warn('[AppInitializer] onNotificationOpenedApp setup failed:', err);
      }

      // Notification open: app was killed when user tapped
      try {
        const initialNotification = await (notificationService as any).checkInitialNotification();
        if (initialNotification) {
          console.info('[Notification] Opened from quit state:', JSON.stringify(initialNotification.data));
        }
      } catch (err) {
        console.warn('[AppInitializer] checkInitialNotification failed:', err);
      }
    })();

    return () => {
      // NOTE: Do NOT call apiClient.destroy() here.
      // Cleanup runs on Fast Refresh and unmount, which would wipe
      // auth tokens and log the user out unexpectedly.
      // Token clearing is handled exclusively by the logout flow.
      if (foregroundUnsub) foregroundUnsub();
      if (openedAppUnsub) openedAppUnsub();
    };
  }, []);

  return <>{children}</>;
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <UserProvider>
              <DataProvider>
                <LocationProvider>
                  <EntitlementProvider>
                    <ToastProvider>
                      <AppInitializer>
                        <RootNavigator />
                      </AppInitializer>
                    </ToastProvider>
                  </EntitlementProvider>
                </LocationProvider>
              </DataProvider>
            </UserProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
