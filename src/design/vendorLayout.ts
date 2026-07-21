import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Matches VendorTabs custom floating tab bar */
export const VENDOR_TAB_BAR_HEIGHT = 64;
/** Center Offers FAB rises above the bar */
export const VENDOR_TAB_BAR_FAB_OVERHANG = 14;
/** Floating bar gap from physical bottom (min with insets) */
export const VENDOR_TAB_BAR_BOTTOM_GAP = 12;
/** Extra breathing room above the tab bar */
export const VENDOR_TAB_CONTENT_GAP = 28;

/** Shared vendor screen tokens — cream/bronze brand preserved */
export const VendorUI = {
  colors: {
    bg: '#FFF9F2',
    white: '#FFFFFF',
    surface: '#FBEFE2',
    text: '#2C1810',
    textSecondary: '#8B7355',
    textMuted: '#B8A88A',
    primary: '#B9834B',
    primaryDark: '#63300E',
    primaryLight: '#D4A87A',
    border: 'rgba(200, 155, 60, 0.2)',
    success: '#6B8F71',
    shadow: 'rgba(185, 131, 75, 0.18)',
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    screen: 16,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    full: 999,
  },
  typography: {
    title: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
    section: { fontSize: 16, fontWeight: '800' as const },
    body: { fontSize: 14, fontWeight: '500' as const },
    caption: { fontSize: 12, fontWeight: '600' as const },
    label: { fontSize: 11, fontWeight: '600' as const },
  },
  buttonHeight: 48,
  headerBtnSize: 40,
};

export function getVendorTabBarClearance(bottomInset: number): number {
  const floatGap = Math.max(bottomInset, VENDOR_TAB_BAR_BOTTOM_GAP);
  return (
    VENDOR_TAB_BAR_HEIGHT +
    VENDOR_TAB_BAR_FAB_OVERHANG +
    floatGap +
    VENDOR_TAB_CONTENT_GAP
  );
}

/**
 * Safe-area insets + scroll padding for Vendor tab screens
 * (Home / Offers / Analytics / Profile under VendorTabs).
 */
export function useVendorScreenInsets(options?: { withTabBar?: boolean }) {
  const insets = useSafeAreaInsets();
  const withTabBar = options?.withTabBar !== false;

  return useMemo(() => {
    const tabClearance = withTabBar ? getVendorTabBarClearance(insets.bottom) : insets.bottom + VENDOR_TAB_CONTENT_GAP;
    return {
      top: insets.top,
      bottom: insets.bottom,
      left: insets.left,
      right: insets.right,
      /** paddingTop for headers sitting under the status bar / Dynamic Island */
      headerPadTop: Math.max(insets.top, 8) + 8,
      /** contentContainerStyle.paddingBottom so lists clear the floating tab bar */
      scrollPadBottom: tabClearance,
      tabClearance,
    };
  }, [insets.top, insets.bottom, insets.left, insets.right, withTabBar]);
}
