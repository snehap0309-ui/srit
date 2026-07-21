import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Production deep links / App Links.
 * Custom scheme: palsafar://
 * HTTPS App Links: https://palsafar.com (requires assetlinks.json on the host).
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'palsafar://',
    'https://palsafar.com',
    'https://www.palsafar.com',
  ],
  config: {
    screens: {
      MainTabs: {
        path: '',
        screens: {
          Home: 'home',
          Explore: 'reels',
          Map: 'map',
          Itinerary: 'trips',
          Profile: 'profile',
        },
      },
      SpotDetail: 'place/:spotId',
      VendorProfile: {
        path: 'vendor/:vendorId',
        parse: {
          vendorId: (id: string) => id,
        },
      },
      TripDetail: 'trip/:tripId',
      LegalDocument: {
        path: 'legal/:type',
        parse: {
          type: (type: string) => type as any,
        },
      },
      LegalHub: 'legal',
      Rewards: 'rewards',
      Wallet: 'wallet',
      Settings: 'settings',
      Notifications: 'notifications',
      Auth: {
        path: 'auth',
        screens: {
          Login: 'login',
          Signup: 'signup',
          ForgotPassword: 'forgot-password',
        },
      },
    },
  },
};
