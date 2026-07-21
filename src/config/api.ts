import { Platform } from 'react-native';
import { DEV_FLAGS } from './devFlags';

function isAndroidEmulator(): boolean {
  if (Platform.OS !== 'android') return false;
  const c = Platform.constants as { Fingerprint?: string; Model?: string };
  const fingerprint = (c.Fingerprint || '').toLowerCase();
  const model = (c.Model || '').toLowerCase();
  return (
    fingerprint.includes('generic') ||
    fingerprint.includes('emulator') ||
    model.includes('sdk_gphone') ||
    model.includes('emulator')
  );
}

// Local API only in dev on emulator/simulator — production always uses remote.
const USE_LOCAL_API = __DEV__ && DEV_FLAGS.USE_LOCAL_API && (Platform.OS === 'android' ? isAndroidEmulator() : __DEV__);

const LOCAL_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000/api/v1' : 'http://localhost:5000/api/v1';

const REMOTE_API_URL = 'https://palsafar-xwui.onrender.com/api/v1';

export const API_CONFIG = {
  baseUrl: USE_LOCAL_API ? LOCAL_API_URL : REMOTE_API_URL,
  timeout: 60000,
  endpoints: {
    auth: {
      register: '/auth/register',
      login: '/auth/login',
      me: '/auth/me',
      refresh: '/auth/refresh',
      logout: '/auth/logout',
      activeMode: '/auth/active-mode',
      activeRole: '/auth/active-role',
    },
    users: {
      list: '/users',
      byId: (id: string) => `/users/${id}`,
      role: (id: string) => `/users/${id}/role`,
    },
    places: {
      list: '/places',
      mine: '/places/mine',
      byId: (id: string) => `/places/${id}`,
      status: (id: string) => `/places/${id}/status`,
      search: '/places/search',
      trending: '/places/trending',
      hiddenGems: '/places/hidden-gems',
      recommendations: (id: string) => `/places/${id}/recommendations`,
      viewport: '/places/viewport',
      adminPending: '/admin/places/pending',
      adminApprove: (id: string) => `/admin/places/${id}/approve`,
      adminReject: (id: string) => `/admin/places/${id}/reject`,
      images: (id: string) => `/places/${id}/images`,
    },
    hiddenGems: {
      list: '/hidden-gems',
      byId: (id: string) => `/hidden-gems/${id}`,
      approve: (id: string) => `/admin/hidden-gems/${id}/approve`,
      reject: (id: string) => `/admin/hidden-gems/${id}/reject`,
    },
    trips: {
      list: '/trips',
      byId: (id: string) => `/trips/${id}`,
      create: '/trips',
      update: (id: string) => `/trips/${id}`,
      delete: (id: string) => `/trips/${id}`,
      duplicate: (id: string) => `/trips/${id}/duplicate`,
      addStop: (dayId: string) => `/trips/days/${dayId}/stops`,
      updateStop: (stopId: string) => `/trips/stops/${stopId}`,
      deleteStop: (stopId: string) => `/trips/stops/${stopId}`,
      reorderStops: (dayId: string) => `/trips/days/${dayId}/stops/reorder`,
      generateItinerary: (id: string) => `/trips/${id}/generate`,
      optimizeRoute: (id: string) => `/trips/${id}/optimize`,
      aiGenerate: '/trips/ai-generate',
      quickAdd: '/trips/quick-add',
      addCollaborator: (id: string) => `/trips/${id}/collaborators`,
      removeCollaborator: (id: string, userId: string) => `/trips/${id}/collaborators/${userId}`,
      updateCollaboratorRole: (id: string, userId: string) => `/trips/${id}/collaborators/${userId}`,
      start: (id: string) => `/trips/${id}/start`,
      complete: (id: string) => `/trips/${id}/complete`,
      progress: (id: string) => `/trips/${id}/progress`,
      history: '/trips/history/completed',
      visitStop: (stopId: string) => `/trips/stops/${stopId}/visit`,
      skipStop: (stopId: string) => `/trips/stops/${stopId}/skip`,
    },
    vendors: {
      list: '/vendors',
      nearby: '/vendors/nearby',
      mapList: '/vendors/map-list',
      register: '/vendors/register',
      me: '/vendors/me',
      byId: (id: string) => `/vendors/${id}`,
      details: (id: string) => `/vendors/${id}/details`,
      reviews: (id: string) => `/vendors/${id}/reviews`,
      review: (id: string) => `/vendors/${id}/review`,
      reviewHelpful: (id: string, reviewId: string) => `/vendors/${id}/reviews/${reviewId}/helpful`,
      createReel: '/vendors/reels',
      reels: (id: string) => `/vendors/${id}/reels`,
      verify: (id: string) => `/vendors/${id}/verify`,
      location: (id: string) => `/vendors/${id}/location`,
      offers: {
        list: '/vendors/offers',
        mine: '/vendors/offers/mine',
        byId: (id: string) => `/vendors/offers/${id}`,
        create: '/vendors/offers',
        update: (id: string) => `/vendors/offers/${id}`,
        delete: (id: string) => `/vendors/offers/${id}`,
        pause: (id: string) => `/vendors/offers/${id}/pause`,
        resume: (id: string) => `/vendors/offers/${id}/resume`,
        duplicate: (id: string) => `/vendors/offers/${id}/duplicate`,
        view: (id: string) => `/vendors/offers/${id}/view`,
        click: (id: string) => `/vendors/offers/${id}/click`,
      },
      dashboard: '/vendors/me/dashboard',
      analytics: '/vendors/me/analytics',
      offerAnalytics: (id: string) => `/vendors/me/offers/${id}/analytics`,
    },
    wallet: {
      profile: '/wallet/profile',
      transactions: '/wallet/transactions',
      earn: '/wallet/earn',
      spend: '/wallet/spend',
      adjust: (userId: string) => `/wallet/adjust/${userId}`,
    },
    rewards: {
      list: '/rewards',
      byId: (id: string) => `/rewards/${id}`,
      offers: '/rewards/offers',
      nearby: '/rewards/nearby',
    },
    pointRules: {
      list: '/point-rules',
      byKey: (key: string) => `/point-rules/${key}`,
    },
    sync: {
      batch: '/sync/batch',
      pending: '/sync/pending',
      status: '/sync/status',
    },
    upload: {
      single: '/upload/single',
      multiple: '/upload/multiple',
      video: '/upload/video',
    },
    rides: {
      estimates: '/rides/estimates',
    },
    notifications: {
      registerToken: '/notifications/register-token',
      unregisterToken: '/notifications/unregister-token',
      list: '/notifications',
      markRead: '/notifications/mark-read',
      markAllRead: '/notifications/mark-all-read',
    },
    health: '/health',
  },
};
