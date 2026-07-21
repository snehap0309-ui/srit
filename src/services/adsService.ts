import { Platform } from 'react-native';
import { monetizationApi } from './api/monetization';

export type ClientAdConfig = {
  showAds: boolean;
  killSwitch: boolean;
  interstitialCooldownSec: number;
  rewardedPoints: number;
  banner: boolean;
  interstitial: boolean;
  rewarded: boolean;
  native: boolean;
  units: {
    banner?: string | null;
    interstitial?: string | null;
    rewarded?: string | null;
    native?: string | null;
  };
};

let cached: ClientAdConfig | null = null;
let lastInterstitialAt = 0;
let mobileAdsReady = false;

function loadAds(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-google-mobile-ads');
  } catch {
    return null;
  }
}

const FALLBACK: ClientAdConfig = {
  showAds: false,
  killSwitch: true,
  interstitialCooldownSec: 120,
  rewardedPoints: 0,
  banner: false,
  interstitial: false,
  rewarded: false,
  native: false,
  units: {},
};

export const adsService = {
  isSdkAvailable(): boolean {
    return !!loadAds();
  },

  async init(): Promise<void> {
    const ads = loadAds();
    if (!ads || mobileAdsReady) return;
    try {
      await ads.mobileAds().initialize();
      mobileAdsReady = true;
    } catch {
      mobileAdsReady = false;
    }
  },

  async refreshConfig(opts?: { country?: string; appVersion?: string }): Promise<ClientAdConfig> {
    try {
      const data = await monetizationApi.getAdConfig({
        country: opts?.country,
        appVersion: opts?.appVersion,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      });
      cached = {
        showAds: !!data.showAds,
        killSwitch: !!data.killSwitch,
        interstitialCooldownSec: Number(data.interstitialCooldownSec ?? 120),
        rewardedPoints: Number(data.rewardedPoints ?? 0),
        banner: !!data.banner,
        interstitial: !!data.interstitial,
        rewarded: !!data.rewarded,
        native: !!data.native,
        units: data.units || {},
      };
      return cached;
    } catch {
      cached = FALLBACK;
      return cached;
    }
  },

  getConfig(): ClientAdConfig {
    return cached || FALLBACK;
  },

  /** Premium / kill-switch / admin disable → never show ads */
  canShow(kind: 'banner' | 'interstitial' | 'rewarded' | 'native'): boolean {
    const c = this.getConfig();
    if (!c.showAds || c.killSwitch) return false;
    return !!c[kind] && !!c.units[kind];
  },

  async showInterstitial(): Promise<boolean> {
    if (!this.canShow('interstitial')) return false;
    const ads = loadAds();
    if (!ads) return false;
    const unit = this.getConfig().units.interstitial!;
    const cooldown = this.getConfig().interstitialCooldownSec * 1000;
    if (Date.now() - lastInterstitialAt < cooldown) return false;

    await this.init();
    return new Promise((resolve) => {
      const interstitial = ads.InterstitialAd.createForAdRequest(unit, {
        requestNonPersonalizedAdsOnly: true,
      });
      const unsubLoaded = interstitial.addAdEventListener(ads.AdEventType.LOADED, () => {
        interstitial.show();
      });
      const unsubClosed = interstitial.addAdEventListener(ads.AdEventType.CLOSED, () => {
        lastInterstitialAt = Date.now();
        unsubLoaded();
        unsubClosed();
        unsubError();
        resolve(true);
      });
      const unsubError = interstitial.addAdEventListener(ads.AdEventType.ERROR, () => {
        unsubLoaded();
        unsubClosed();
        unsubError();
        resolve(false);
      });
      interstitial.load();
    });
  },

  async showRewarded(): Promise<{ watched: boolean; points: number }> {
    if (!this.canShow('rewarded')) return { watched: false, points: 0 };
    const ads = loadAds();
    if (!ads) return { watched: false, points: 0 };
    const unit = this.getConfig().units.rewarded!;
    const points = this.getConfig().rewardedPoints;
    await this.init();

    return new Promise((resolve) => {
      const rewarded = ads.RewardedAd.createForAdRequest(unit, {
        requestNonPersonalizedAdsOnly: true,
      });
      let earned = false;
      const unsubLoaded = rewarded.addAdEventListener(ads.AdEventType.LOADED, () => rewarded.show());
      const unsubEarned = rewarded.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      });
      const unsubClosed = rewarded.addAdEventListener(ads.AdEventType.CLOSED, () => {
        unsubLoaded();
        unsubEarned();
        unsubClosed();
        unsubError();
        resolve({ watched: earned, points: earned ? points : 0 });
      });
      const unsubError = rewarded.addAdEventListener(ads.AdEventType.ERROR, () => {
        unsubLoaded();
        unsubEarned();
        unsubClosed();
        unsubError();
        resolve({ watched: false, points: 0 });
      });
      rewarded.load();
    });
  },
};
