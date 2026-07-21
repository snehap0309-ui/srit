import React, { useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { VendorTabParamList, RootStackParamList } from './types';
import { useUserContext } from '../context/UserContext';
import { useDataContext } from '../context/DataContext';
import { useLazyScreen } from '../utils/useLazyScreen';
import {
  VENDOR_TAB_BAR_BOTTOM_GAP,
  VENDOR_TAB_BAR_HEIGHT,
  VendorUI,
} from '../design/vendorLayout';

const Tab = createBottomTabNavigator<VendorTabParamList>();
type RootNav = NativeStackNavigationProp<RootStackParamList>;
type VendorTabName = keyof VendorTabParamList;

const TAB_ICONS: Record<VendorTabName, { active: string; inactive: string; label: string }> = {
  Home: { active: 'home', inactive: 'home-outline', label: 'Home' },
  Points: { active: 'diamond', inactive: 'diamond-outline', label: 'Points' },
  Offers: { active: 'pricetag', inactive: 'pricetag-outline', label: 'Offers' },
  Analytics: { active: 'stats-chart', inactive: 'stats-chart-outline', label: 'Stats' },
  Profile: { active: 'storefront', inactive: 'storefront-outline', label: 'Profile' },
};

function useVendorIds() {
  const { user, onLogout } = useUserContext();
  const { currentVendor, logoutVendor } = useDataContext();
  const vendorId = (user as any)?.vendor?.id || currentVendor?.id || '';
  const vendorName = (user as any)?.vendor?.businessName || currentVendor?.businessName || 'My Business';
  const handleLogout = useCallback(async () => {
    logoutVendor();
    await onLogout();
  }, [logoutVendor, onLogout]);
  return { vendorId, vendorName, currentVendor, handleLogout, user };
}

function VendorHomeTab() {
  const navigation = useNavigation<RootNav>();
  const { vendorId, vendorName, currentVendor, handleLogout } = useVendorIds();
  const Screen = useLazyScreen(() => require('../screens/VendorDashboardScreen'));

  return (
    <Screen
      forcedTab="Home"
      hideBottomNav
      onBack={() => {}}
      canGoBack={false}
      onLogout={handleLogout}
      onCreateOffer={() => navigation.navigate('CreateOffer', {})}
      onEditOffer={(offerId: string) => navigation.navigate('CreateOffer', { offerId })}
      onCreateReel={() => navigation.navigate('CreateReel')}
      onViewMyOffers={() => navigation.navigate('VendorTabs', { screen: 'Offers' })}
      onViewAnalytics={() => navigation.navigate('VendorAnalytics', { vendorId, vendorName })}
      onViewProfile={() =>
        navigation.navigate('VendorProfile', {
          vendorId: vendorId || currentVendor?.id || 'me',
          self: true,
        })
      }
    />
  );
}

function VendorPointsTab() {
  const { vendorName } = useVendorIds();
  const Screen = useLazyScreen(() => require('../screens/VendorScannerScreen'));
  return <Screen vendorName={vendorName} />;
}

function VendorOffersTab() {
  const navigation = useNavigation<RootNav>();
  const { vendorId, vendorName, currentVendor, handleLogout } = useVendorIds();
  const Screen = useLazyScreen(() => require('../screens/VendorDashboardScreen'));

  return (
    <Screen
      forcedTab="Offers"
      hideBottomNav
      onBack={() => {}}
      canGoBack={false}
      onLogout={handleLogout}
      onCreateOffer={() => navigation.navigate('CreateOffer', {})}
      onEditOffer={(offerId: string) => navigation.navigate('CreateOffer', { offerId })}
      onCreateReel={() => navigation.navigate('CreateReel')}
      onViewMyOffers={() => {}}
      onViewAnalytics={() => navigation.navigate('VendorAnalytics', { vendorId, vendorName })}
      onViewProfile={() =>
        navigation.navigate('VendorProfile', {
          vendorId: vendorId || currentVendor?.id || 'me',
          self: true,
        })
      }
    />
  );
}

function VendorAnalyticsTab() {
  const navigation = useNavigation<RootNav>();
  const { vendorId, vendorName } = useVendorIds();
  const Screen = useLazyScreen(() => require('../screens/VendorAnalyticsScreen'));
  return (
    <Screen
      vendorId={vendorId}
      vendorName={vendorName}
      onBack={() => navigation.navigate('VendorTabs', { screen: 'Home' })}
    />
  );
}

function VendorProfileTab() {
  const navigation = useNavigation<RootNav>();
  const { vendorId, currentVendor } = useVendorIds();
  const Screen = useLazyScreen(() => require('../screens/VendorProfileScreen'));
  // Prefer stable id so Profile does not remount-fetch when context fills in
  const stableId = currentVendor?.id || vendorId || 'me';
  return (
    <Screen
      key="vendor-self-profile"
      vendorId={stableId}
      self
      initialTab="info"
      onNavigate={(screen: string, params?: any) => {
        if (screen === 'goBack') navigation.navigate('VendorTabs', { screen: 'Home' });
        else navigation.navigate(screen as any, params);
      }}
    />
  );
}

function VendorTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.customTabBar,
        { bottom: Math.max(insets.bottom, VENDOR_TAB_BAR_BOTTOM_GAP) },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const name = route.name as VendorTabName;
        const config = TAB_ICONS[name] || { active: 'ellipse', inactive: 'ellipse-outline', label: name };
        const isCenter = name === 'Offers';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (isCenter) {
          return (
            <TouchableOpacity key={route.key} style={styles.centerButtonWrap} onPress={onPress} activeOpacity={0.9}>
              <View style={[styles.centerButton, isFocused && styles.centerButtonActive]}>
                <Icon
                  name={isFocused ? config.active : config.inactive}
                  size={24}
                  color="#FFF9F2"
                />
              </View>
              <Text style={[styles.tabLabel, { color: isFocused ? '#63300E' : '#8B7355', marginTop: 2, fontWeight: '700' }]}>
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity key={route.key} style={styles.tabItem} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.tabContentInner}>
              <Icon
                name={isFocused ? config.active : config.inactive}
                size={22}
                color={isFocused ? '#B9834B' : '#8B7355'}
              />
              <Text style={[styles.tabLabel, { color: isFocused ? '#B9834B' : '#8B7355' }]}>{config.label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function VendorTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <VendorTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={VendorHomeTab} />
      <Tab.Screen name="Points" component={VendorPointsTab} />
      <Tab.Screen name="Offers" component={VendorOffersTab} />
      <Tab.Screen name="Analytics" component={VendorAnalyticsTab} />
      <Tab.Screen name="Profile" component={VendorProfileTab} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  customTabBar: {
    position: 'absolute',
    left: VendorUI.space.screen,
    right: VendorUI.space.screen,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: VendorUI.space.sm,
    height: VENDOR_TAB_BAR_HEIGHT,
    backgroundColor: VendorUI.colors.surface,
    borderWidth: 1,
    borderColor: VendorUI.colors.border,
    shadowColor: 'rgba(185, 131, 75, 0.35)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabContentInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  centerButtonWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  centerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#63300E',
    justifyContent: 'center',
    alignItems: 'center',
    top: -14,
    borderWidth: 3,
    borderColor: '#FBEFE2',
    shadowColor: '#63300E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  centerButtonActive: {
    backgroundColor: '#B9834B',
    borderColor: '#FFF9F2',
  },
});
