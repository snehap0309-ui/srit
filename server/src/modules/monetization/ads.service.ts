import { prisma } from '../../config/database';
import { ApiError } from '../../shared/utils/ApiError';
import { entitlementsService } from './entitlements.service';

const DEFAULT_KEY = 'default';

export const adsService = {
  async ensureDefault() {
    const existing = await prisma.adConfiguration.findUnique({ where: { key: DEFAULT_KEY } });
    if (existing) return existing;
    return prisma.adConfiguration.create({
      data: { key: DEFAULT_KEY },
    });
  },

  async getAdminConfig() {
    return this.ensureDefault();
  },

  async update(input: Record<string, unknown>) {
    await this.ensureDefault();
    return prisma.adConfiguration.update({
      where: { key: DEFAULT_KEY },
      data: input as any,
    });
  },

  async getClientConfig(opts: {
    userId?: string;
    country?: string;
    appVersion?: string;
    platform?: 'android' | 'ios';
  }) {
    const config = await this.ensureDefault();
    let isPremium = false;
    if (opts.userId) {
      const entitlements = await entitlementsService.getForUser(opts.userId);
      isPremium = entitlements.isPremium;
    }

    const countryOk =
      !config.enabledCountries.length
      || !opts.country
      || config.enabledCountries.map((c) => c.toUpperCase()).includes(opts.country.toUpperCase());

    const versionOk =
      !config.enabledAppVersions.length
      || !opts.appVersion
      || config.enabledAppVersions.includes(opts.appVersion);

    const adsAllowed =
      !isPremium
      && config.adsEnabled
      && !config.killSwitch
      && countryOk
      && versionOk;

    const platform = opts.platform || 'android';

    return {
      showAds: adsAllowed,
      killSwitch: config.killSwitch,
      interstitialCooldownSec: config.interstitialCooldownSec,
      rewardedPoints: config.rewardedPoints,
      banner: adsAllowed && config.bannerEnabled,
      interstitial: adsAllowed && config.interstitialEnabled,
      rewarded: adsAllowed && config.rewardedEnabled,
      native: adsAllowed && config.nativeEnabled,
      units: {
        banner: platform === 'ios' ? config.bannerAdUnitIdIos : config.bannerAdUnitIdAndroid,
        interstitial: platform === 'ios' ? config.interstitialAdUnitIdIos : config.interstitialAdUnitIdAndroid,
        rewarded: platform === 'ios' ? config.rewardedAdUnitIdIos : config.rewardedAdUnitIdAndroid,
        native: platform === 'ios' ? config.nativeAdUnitIdIos : config.nativeAdUnitIdAndroid,
      },
    };
  },

  async requireConfig() {
    const config = await this.getAdminConfig();
    if (!config) throw new ApiError(404, 'Ad configuration not found');
    return config;
  },
};
