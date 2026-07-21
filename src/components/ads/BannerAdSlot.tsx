import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useEntitlements } from '../../context/EntitlementContext';
import { adsService } from '../../services/adsService';

/** Renders a banner only when admin config allows and user is not Premium. */
export default function BannerAdSlot() {
  const { showAds, isPremium } = useEntitlements();
  const [ready, setReady] = useState(false);
  const [BannerAd, setBannerAd] = useState<any>(null);
  const [BannerAdSize, setBannerAdSize] = useState<any>(null);
  const [unitId, setUnitId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isPremium || !showAds) return;
      await adsService.refreshConfig();
      if (!adsService.canShow('banner') || !adsService.isSdkAvailable()) return;
      await adsService.init();
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ads = require('react-native-google-mobile-ads');
        if (cancelled) return;
        setBannerAd(() => ads.BannerAd);
        setBannerAdSize(ads.BannerAdSize);
        setUnitId(adsService.getConfig().units.banner || null);
        setReady(true);
      } catch {
        /* SDK missing in this binary */
      }
    })();
    return () => { cancelled = true; };
  }, [isPremium, showAds]);

  if (isPremium || !showAds || !ready || !BannerAd || !unitId) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BannerAd unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', backgroundColor: 'transparent' },
});
