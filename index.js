// Safe console polyfill to prevent early logging crashes
if (typeof global.console === 'undefined') {
  global.console = {
    log: () => {},
    warn: () => {},
    error: () => {},
    info: () => {},
    debug: () => {},
    trace: () => {},
  };
}

if (typeof global.window === 'undefined') {
  global.window = global;
}
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: () => {
      const performanceNow = global.nativePerformanceNow || Date.now;
      return performanceNow();
    },
    mark: () => {},
    measure: () => {},
    clearMarks: () => {},
    clearMeasures: () => {},
  };
}

// Do NOT stub ErrorUtils here. Metro/RN polyfills install the real handler.
// A custom reportFatalError → Alert.alert('Fatal JS Error') blocked RN's
// handler and showed popup alerts for every fatal JS exception.

import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import AppWrapper from './App';
import {name as appName} from './app.json';

// Background/quit-state FCM handler — MUST be registered at entry point per Firebase docs
try {
  const messaging = require('@react-native-firebase/messaging');
  const setBackgroundMessageHandler =
    messaging.setBackgroundMessageHandler ||
    messaging.default?.setBackgroundMessageHandler;
  const getMessaging = messaging.getMessaging || messaging.default?.getMessaging;

  if (typeof setBackgroundMessageHandler === 'function' && typeof getMessaging === 'function') {
    setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
      if (__DEV__) {
        console.log('[FCM] Background message received:', remoteMessage?.messageId);
      }
    });
  } else if (typeof messaging.default === 'function') {
    // Legacy namespaced API
    messaging.default().setBackgroundMessageHandler(async (remoteMessage) => {
      if (__DEV__) {
        console.log('[FCM] Background message received:', remoteMessage?.messageId);
      }
    });
  }
} catch (error) {
  console.warn('[FCM] Failed to register background handler:', error);
}

AppRegistry.registerComponent(appName, () => AppWrapper);
