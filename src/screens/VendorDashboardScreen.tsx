import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
  RefreshControl, Animated, Dimensions, Platform, Alert, FlatList, Image,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  MaterialIcons, Ionicons, MaterialCommunityIcons, Feather,
} from '../utils/Icons';
import { useDataContext } from '../context/DataContext';
import { getVendorCategoryEmoji } from '../data/vendors';
import { LinearGradient } from '../utils/LinearGradient';
import { VendorBusiness } from '../types';
import { notificationService } from '../services/notificationService';
import { InAppNotification } from '../services/api/notifications';
import { vendorsApi } from '../services/api/vendors';
import { DEV_FLAGS } from '../config/devFlags';
import { useVendorScreenInsets, VendorUI } from '../design/vendorLayout';
import type { RootStackParamList } from '../navigation/types';
import { copyToClipboard } from '../utils/clipboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_RADIUS = 22;
const ICON_RADIUS = 18;
const BANNER_RADIUS = 24;

const COLORS = {
  // PalSafar cream / bronze (aligned with tourist app)
  sky: '#B9834B',
  skyDark: '#8B6B3A',
  skyDeep: '#63300E',
  skyMedium: '#D4A87A',
  skyLight: '#D4A87A',
  skyPale: '#FBEFE2',
  skyVeryPale: '#FFF5EB',
  white: '#FFF9F2',
  bg: '#FFF9F2',
  textPrimary: '#2C1810',
  textSecondary: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(200, 155, 60, 0.2)',
  shadow: 'rgba(185, 131, 75, 0.18)',
  success: '#6B8F71',
  warning: '#B9834B',
  star: '#B9834B',
  cardBg: '#FBEFE2',
};

const NAV_ITEMS = [
  { key: 'Home', icon: 'home', iconSet: 'Ionicons' },
  { key: 'Offers', icon: 'local-offer', iconSet: 'MaterialIcons' },
  { key: 'Analytics', icon: 'bar-chart-2', iconSet: 'Feather' },
  { key: 'Profile', icon: 'person', iconSet: 'Ionicons' },
] as const;

interface VendorDashboardScreenProps {
  onBack: () => void;
  onLogout?: () => void;
  onCreateOffer: () => void;
  onEditOffer?: (offerId: string) => void;
  onCreateReel?: () => void;
  onViewMyOffers?: () => void;
  onViewAnalytics: () => void;
  onViewProfile?: () => void;
  canGoBack?: boolean;
  /** When set by VendorTabs, locks content to that section */
  forcedTab?: 'Home' | 'Offers';
  /** Hide legacy fake bottom nav when real VendorTabs are used */
  hideBottomNav?: boolean;
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <MaterialIcons
        key={i}
        name={i <= Math.floor(rating) ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-border'}
        size={size}
        color={COLORS.star}
        style={{ marginRight: 1 }}
      />
    );
  }
  return <View style={{ flexDirection: 'row', alignItems: 'center' }}>{stars}</View>;
}

function PerformanceCard({ icon, label, value, color, iconSet = 'MaterialIcons' }: {
  icon: string; label: string; value: string | number; color: string; iconSet?: string;
}) {
  const IconComponent =
    iconSet === 'Ionicons' ? Ionicons :
    iconSet === 'Feather' ? Feather :
    MaterialIcons;

  return (
    <View style={s.performanceCard}>
      <View style={[s.perfIconWrap, { backgroundColor: color + '12' }]}>
        <IconComponent name={icon} size={20} color={color} />
      </View>
      <Text style={s.perfValue}>{value}</Text>
      <Text style={s.perfLabel}>{label}</Text>
    </View>
  );
}

interface NotifItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  createdAt: string;
}

function NotificationsDropdown({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications(1, 20);
      const mapped: NotifItem[] = (data || []).map((n: InAppNotification) => ({
        id: n.id,
        title: n.title,
        desc: n.body || '',
        time: formatNotifTime(n.createdAt),
        read: n.read,
        createdAt: n.createdAt,
      }));
      setNotifications(mapped);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) fetchNotifications();
  }, [visible, fetchNotifications]);

  const handleMarkRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await notificationService.markAsRead(id);
    } catch (e) { console.warn('Caught empty exception', e); }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await notificationService.markAllAsRead();
    } catch (e) { console.warn('Caught empty exception', e); }
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!visible) return null;

  return (
    <View style={s.notifDropdown}>
      <View style={s.notifHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.notifHeader}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={s.notifBadge}>
              <Text style={s.notifBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={onClose} style={s.notifCloseBtn}>
          <MaterialIcons name="close" size={20} color={COLORS.skyDeep} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: COLORS.textMuted }}>Loading...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <Ionicons name="notifications-off-outline" size={32} color={COLORS.textMuted} />
          <Text style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 8 }}>No notifications yet</Text>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
          {notifications.slice(0, 10).map(n => (
            <TouchableOpacity
              key={n.id}
              style={[s.notifItem, !n.read && { backgroundColor: COLORS.skyPale }]}
              onPress={() => handleMarkRead(n.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.notifTitle, !n.read && { fontWeight: '700' }]}>{n.title}</Text>
                {n.desc ? <Text style={s.notifDesc}>{n.desc}</Text> : null}
                <Text style={s.notifTime}>{n.time}</Text>
              </View>
              {!n.read && <View style={s.notifUnreadDot} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!loading && notifications.length > 0 && (
        <>
          <View style={s.notifFooter}>
            {unreadCount > 0 && (
              <TouchableOpacity style={s.notifFooterBtn} onPress={handleMarkAllRead}>
                <Text style={s.notifFooterBtnText}>Mark all as read</Text>
              </TouchableOpacity>
            )}
            {notifications.length > 10 && (
              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>+{notifications.length - 10} more</Text>
            )}
          </View>
        </>
      )}
    </View>
  );
}

function formatNotifTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const OFFER_FILTERS = ['Active', 'Scheduled', 'Expired', 'Draft'] as const;
type OfferFilter = (typeof OFFER_FILTERS)[number];

function getOfferLifecycleStatus(offer: any): OfferFilter {
  const now = Date.now();
  if (!offer.isActive) return 'Draft';
  if (offer.validTill) {
    const end = new Date(offer.validTill).getTime();
    if (!Number.isNaN(end) && end < now) return 'Expired';
  }
  if (offer.startDate) {
    const start = new Date(offer.startDate).getTime();
    if (!Number.isNaN(start) && start > now) return 'Scheduled';
  }
  return 'Active';
}

function formatOfferDate(value?: string | null): string {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTimeLeft(offer: any, status: OfferFilter): string {
  if (status === 'Draft') return 'Not published';
  if (status === 'Expired') {
    if (!offer.validTill) return 'Expired';
    const end = new Date(offer.validTill).getTime();
    if (Number.isNaN(end)) return 'Expired';
    const days = Math.max(1, Math.floor((Date.now() - end) / (1000 * 60 * 60 * 24)));
    return `Expired ${days} day${days !== 1 ? 's' : ''} ago`;
  }
  const target = status === 'Scheduled' ? offer.startDate : offer.validTill;
  if (!target) return status === 'Scheduled' ? 'Scheduled' : 'No end date';
  const t = new Date(target).getTime();
  if (Number.isNaN(t)) return 'N/A';
  const days = Math.max(0, Math.floor((t - Date.now()) / (1000 * 60 * 60 * 24)));
  if (status === 'Scheduled') return `${days} day${days !== 1 ? 's' : ''}`;
  return `${days} day${days !== 1 ? 's' : ''} left`;
}

function discountLabel(offer: any): string {
  if (offer.discountType === 'percentage') return `${offer.discountValue}% OFF`;
  if (offer.discountType === 'flat') return `₹${offer.discountValue} OFF`;
  if (offer.discountType === 'freebie') return 'Freebie';
  return 'Special';
}

function OffersView({
  onCreateOffer,
  onEditOffer,
  totalOffers = 0,
  activeOffers = 0,
  totalRedemptions = 0,
  pointsRedeemed = 0,
  offers = [],
  refreshing = false,
  onRefresh,
  scrollPadBottom = 120,
}: {
  onCreateOffer: () => void;
  onEditOffer?: (offerId: string) => void;
  totalOffers?: number;
  activeOffers?: number;
  totalRedemptions?: number;
  pointsRedeemed?: number;
  offers?: any[];
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollPadBottom?: number;
}) {
  const { deleteVendorOffer, toggleVendorOffer, duplicateVendorOffer, refreshVendorData } = useDataContext();
  const [activeFilter, setActiveFilter] = useState<OfferFilter>('Active');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleFilterChange = useCallback((filter: OfferFilter) => {
    LayoutAnimation.configureNext({
      duration: 400,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'spring', springDamping: 0.7 },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    setActiveFilter(filter);
  }, []);

  const filterCounts = useMemo(() => {
    const counts: Record<OfferFilter, number> = { Active: 0, Scheduled: 0, Expired: 0, Draft: 0 };
    offers.forEach((o: any) => {
      counts[getOfferLifecycleStatus(o)] += 1;
    });
    return counts;
  }, [offers]);

  const displayCards = useMemo(() => {
    return offers
      .filter((o: any) => getOfferLifecycleStatus(o) === activeFilter)
      .map((offer: any) => {
        const status = getOfferLifecycleStatus(offer);
        return {
          id: offer.id,
          title: offer.offerTitle || offer.title || '',
          discount: discountLabel(offer),
          points: offer.pointsRequired ?? 0,
          minBill: offer.minBillAmount ? `₹${offer.minBillAmount}` : 'None',
          status,
          startDate: formatOfferDate(offer.startDate),
          validUntil: formatOfferDate(offer.validTill),
          timeLeft: formatTimeLeft(offer, status),
          imageUrl: offer.imageUrl || '',
          redemptions: offer.currentRedemptions ?? offer.redemptions ?? 0,
          createdAt: offer.createdAt,
          isActive: !!offer.isActive,
        };
      });
  }, [offers, activeFilter]);

  const handleDelete = useCallback((offerId: string, title: string) => {
    Alert.alert('Delete offer', `Delete "${title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusyId(offerId);
            await deleteVendorOffer(offerId);
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete offer.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }, [deleteVendorOffer]);

  const handleToggle = useCallback(async (offerId: string, currentlyActive: boolean) => {
    try {
      setBusyId(offerId);
      await toggleVendorOffer(offerId);
    } catch (err: any) {
      Alert.alert('Error', err?.message || `Failed to ${currentlyActive ? 'pause' : 'resume'} offer.`);
    } finally {
      setBusyId(null);
    }
  }, [toggleVendorOffer]);

  const handleDuplicate = useCallback((offerId: string, title: string) => {
    Alert.alert('Duplicate offer', `Create a copy of "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Duplicate',
        onPress: async () => {
          try {
            setBusyId(offerId);
            const created = await duplicateVendorOffer(offerId);
            await refreshVendorData().catch(() => {});
            if (created?.id) {
              Alert.alert('Offer duplicated', 'A draft copy was created. Edit and publish when ready.');
            }
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to duplicate offer.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }, [duplicateVendorOffer, refreshVendorData]);

  const handleOfferStats = useCallback(async (offerId: string, title: string) => {
    try {
      setBusyId(offerId);
      const res = await vendorsApi.getOfferAnalytics(offerId);
      const data = (res as any)?.data ?? res;
      const r = data?.redemptions || {};
      const o = data?.offer || {};
      Alert.alert(
        title || 'Offer stats',
        [
          `Views: ${o.viewCount ?? 0}`,
          `Clicks: ${o.clickCount ?? 0}`,
          `Redemptions: ${r.total ?? o.currentRedemptions ?? 0}`,
          `Verified: ${r.verified ?? 0}`,
          `Points spent: ${r.totalPointsSpent ?? 0}`,
        ].join('\n'),
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not load offer analytics.');
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <ScrollView
      style={s.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: scrollPadBottom }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.sky} />
        ) : undefined
      }
    >
      <View style={s.OvHeader}>
        <View style={s.OvHeaderLeft}>
          <Text style={s.OvTitle}>Offers</Text>
          <Text style={s.OvSubtitle}>Create and manage offers to attract more tourists.</Text>
        </View>
        <TouchableOpacity style={s.OvCreateBtn} onPress={onCreateOffer} activeOpacity={0.85}>
          <MaterialIcons name="add" size={20} color={COLORS.sky} />
          <Text style={s.OvCreateBtnText}>Create Offer</Text>
        </TouchableOpacity>
      </View>

      <View style={s.OvStatsGrid}>
        {[
          { label: 'Total Offers', value: String(totalOffers), icon: 'local-offer', color: '#B9834B' },
          { label: 'Active Offers', value: String(activeOffers), icon: 'check-circle', color: '#6B8F71' },
          { label: 'Total Redeems', value: String(totalRedemptions), icon: 'receipt', color: '#8B6B3A' },
          { label: 'Points Redeemed', value: pointsRedeemed >= 1000 ? (pointsRedeemed / 1000).toFixed(1) + 'K' : String(pointsRedeemed), icon: 'star', color: '#D4A87A' },
        ].map((item, i) => (
          <View key={i} style={s.OvStatCard}>
            <LinearGradient
              colors={[COLORS.skyPale, COLORS.white, COLORS.skyVeryPale]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.OvStatGradient}
            >
              <View style={[s.OvStatIcon, { backgroundColor: item.color + '25' }]}>
                <MaterialIcons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={s.OvStatValue}>{item.value}</Text>
              <Text style={s.OvStatLabel}>{item.label}</Text>
            </LinearGradient>
          </View>
        ))}
      </View>

      <View style={s.OvFilterCard}>
        <View style={s.OvFilterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.OvFilterRow}>
              {OFFER_FILTERS.map((f) => {
                const isActive = activeFilter === f;
                return (
                  <TouchableOpacity key={f} onPress={() => handleFilterChange(f)} style={s.OvFilterTab}>
                    <Text style={[s.OvFilterText, isActive && s.OvFilterTextActive]}>
                      {f} ({filterCounts[f]})
                    </Text>
                    {isActive && <View style={s.OvFilterLine} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>

      <Text style={s.OvFilterHint}>
        {activeFilter === 'Active' ? 'Visible to tourists now' :
         activeFilter === 'Scheduled' ? 'Goes live on start date' :
         activeFilter === 'Expired' ? 'No longer redeemable' :
         'Paused or unpublished — resume to go live'}
      </Text>

      {displayCards.length === 0 ? (
        <View style={s.emptyRedemptions}>
          <MaterialIcons name="local-offer" size={40} color={COLORS.skyLight} />
          <Text style={s.emptyText}>No {activeFilter.toLowerCase()} offers</Text>
          <Text style={s.emptySubtext}>
            {activeFilter === 'Active'
              ? 'Create an offer to start attracting tourists.'
              : `You have no ${activeFilter.toLowerCase()} offers right now.`}
          </Text>
          {(activeFilter === 'Active' || activeFilter === 'Draft') ? (
            <TouchableOpacity style={[s.OvCreateBtn, { marginTop: 16 }]} onPress={onCreateOffer}>
              <MaterialIcons name="add" size={18} color={COLORS.sky} />
              <Text style={s.OvCreateBtnText}>Create Offer</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {displayCards.map((offer) => {
        const statusColors: Record<string, string> = {
          Active: '#6B8F71', Scheduled: '#B9834B', Expired: '#FF5A5F', Draft: COLORS.textMuted,
        };
        const statusIcons: Record<string, string> = {
          Active: 'check-circle', Scheduled: 'schedule', Expired: 'cancel', Draft: 'edit-note',
        };
        const sc = statusColors[offer.status] || COLORS.textMuted;
        const isBusy = busyId === offer.id;
        return (
          <View key={offer.id} style={s.OvCard}>
            <LinearGradient
              colors={[COLORS.white, COLORS.skyVeryPale]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: CARD_RADIUS, overflow: 'hidden' }}
            >
              <View style={{ flexDirection: 'column' }}>
                <View style={{ width: '100%', height: 130, backgroundColor: COLORS.skyPale }}>
                  {offer.imageUrl ? (
                    <Image
                      source={{ uri: offer.imageUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialIcons name="local-offer" size={36} color={COLORS.sky} />
                    </View>
                  )}
                  <View style={s.OvBadge}>
                    <Text style={s.OvBadgeText}>{offer.discount}</Text>
                  </View>
                </View>
                <View style={s.OvCardBody}>
                  <Text style={s.OvCardTitle} numberOfLines={1}>{offer.title}</Text>
                  <View style={s.OvChipRow}>
                    <View style={[s.OvChip, { backgroundColor: sc + '18' }]}>
                      <MaterialIcons name={statusIcons[offer.status] as any} size={12} color={sc} />
                      <Text style={[s.OvChipText, { color: sc, fontSize: 11 }]}>{offer.status}</Text>
                    </View>
                  </View>
                  <View style={s.OvMetaRow}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.sky + '15', justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialIcons name="stars" size={12} color={COLORS.sky} />
                    </View>
                    <Text style={s.OvMetaText}>{offer.points} pts</Text>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.skyPale, justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialIcons name="payments" size={12} color={COLORS.textSecondary} />
                    </View>
                    <Text style={s.OvMetaText}>Min. {offer.minBill}</Text>
                  </View>
                  <View style={s.OvMetaRow}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.skyPale, justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialIcons name="event" size={12} color={COLORS.textSecondary} />
                    </View>
                    <Text style={s.OvMetaText}>Valid till: {offer.validUntil}</Text>
                  </View>
                  {offer.status !== 'Draft' && (
                    <View style={s.OvStatsMini}>
                      <Text style={s.OvStatsMiniVal}>{offer.redemptions}</Text>
                      <Text style={s.OvStatsMiniLbl}>Total Redeems</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: (offer.status === 'Expired' ? '#FF5A5F' : COLORS.warning) + '18', justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialIcons name="access-time" size={11} color={offer.status === 'Expired' ? '#FF5A5F' : COLORS.warning} />
                    </View>
                    <Text style={{ fontSize: 11, color: offer.status === 'Expired' ? '#FF5A5F' : COLORS.warning, fontWeight: '600' }}>
                      {offer.status === 'Scheduled' ? `Starts in ${offer.timeLeft}` : offer.timeLeft}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={s.OvActionRow}>
                <TouchableOpacity
                  style={s.OvActionBtn}
                  activeOpacity={0.7}
                  disabled={isBusy}
                  onPress={() => onEditOffer?.(offer.id)}
                >
                  <MaterialIcons name="edit" size={14} color={COLORS.sky} />
                  <Text style={s.OvActionText}>Edit</Text>
                </TouchableOpacity>
                {offer.status !== 'Expired' ? (
                  <TouchableOpacity
                    style={s.OvActionBtn}
                    activeOpacity={0.7}
                    disabled={isBusy}
                    onPress={() => handleToggle(offer.id, offer.isActive)}
                  >
                    <MaterialIcons name={offer.isActive ? 'pause' : 'play-arrow'} size={14} color={COLORS.sky} />
                    <Text style={s.OvActionText}>{offer.isActive ? 'Pause' : 'Resume'}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={s.OvActionBtn}
                  activeOpacity={0.7}
                  disabled={isBusy}
                  onPress={() => handleDuplicate(offer.id, offer.title)}
                >
                  <MaterialIcons name="content-copy" size={14} color={COLORS.sky} />
                  <Text style={s.OvActionText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.OvActionBtn}
                  activeOpacity={0.7}
                  disabled={isBusy}
                  onPress={() => handleOfferStats(offer.id, offer.title)}
                >
                  <MaterialIcons name="insights" size={14} color={COLORS.sky} />
                  <Text style={s.OvActionText}>Stats</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.OvActionBtn}
                  activeOpacity={0.7}
                  disabled={isBusy}
                  onPress={() => handleDelete(offer.id, offer.title)}
                >
                  <MaterialIcons name="delete" size={14} color="#FF5A5F" />
                  <Text style={s.OvActionText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        );
      })}
    </ScrollView>
  );
}

export default function VendorDashboardScreen({
  onBack, onLogout, onCreateOffer, onEditOffer, onCreateReel: _onCreateReel,
  onViewMyOffers,
  onViewAnalytics, onViewProfile,
  canGoBack = true,
  forcedTab,
  hideBottomNav = false,
}: VendorDashboardScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentVendor, vendorOffers, redemptions, refreshVendorData } = useDataContext();
  const screenInsets = useVendorScreenInsets({ withTabBar: hideBottomNav });
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showVendorCode, setShowVendorCode] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [activeTab, setActiveTab] = useState<'Home' | 'Offers' | 'Analytics' | 'Profile'>(forcedTab || 'Home');
  const [showSidebar, setShowSidebar] = useState(false);

  const closeSidebarAnd = useCallback((action: () => void) => {
    setShowSidebar(false);
    action();
  }, []);
  const [dashStats, setDashStats] = useState<{
    todayRedemptions?: number;
    totalViews?: number;
    totalClicks?: number;
    conversionRate?: number;
    pendingApproval?: number;
  } | null>(null);

  const visibleTab = forcedTab || activeTab;

  const loadDashboardStats = useCallback(async () => {
    if (!DEV_FLAGS.USE_SERVER_API) return;
    try {
      const res = await vendorsApi.getDashboard();
      const data = (res as any)?.data ?? res;
      const stats = data?.stats || {};
      setDashStats({
        todayRedemptions: Number(stats.todayRedemptions) || 0,
        totalViews: Number(stats.totalViews) || 0,
        totalClicks: Number(stats.totalClicks) || 0,
        conversionRate: Number(stats.conversionRate) || 0,
        pendingApproval: Number(stats.pendingApproval) || 0,
      });
    } catch {
      /* keep local fallbacks */
    }
  }, []);

  // Load once per tab mount — do NOT depend on refreshVendorData/loadDashboardStats
  // identity or currentVendor, or setCurrentVendor creates an infinite getMe loop (429).
  useEffect(() => {
    if (visibleTab !== 'Offers' && visibleTab !== 'Home') return;
    let cancelled = false;
    (async () => {
      try {
        await refreshVendorData();
        if (!cancelled && visibleTab === 'Home') {
          await loadDashboardStats();
        }
      } catch {
        /* non-blocking */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: mount / forcedTab only
  }, [visibleTab]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const sidebarAnim = useRef(new Animated.Value(0)).current;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshVendorData(), loadDashboardStats()]);
    } catch (err) {
      console.warn('Failed to refresh vendor dashboard:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshVendorData, loadDashboardStats]);

  const myOffers = useMemo(() => {
    if (!currentVendor) return [];
    const offerList = vendorOffers.filter(o => o.vendorId === currentVendor.id);
    return offerList.map(o => {
      const reds = redemptions.filter(r => r.offerId === o.id);
      return {
        ...o,
        currentRedemptions: o.currentRedemptions ?? reds.length,
        redemptions: o.currentRedemptions ?? reds.length,
        pointsRedeemed: reds.reduce((sum, r) => sum + (r.pointsSpent || 0), 0),
      };
    });
  }, [currentVendor, vendorOffers, redemptions]);

  const myRedemptions = useMemo(() => {
    if (!currentVendor) return [];
    return redemptions.filter(r => r.vendorId === currentVendor.id);
  }, [currentVendor, redemptions]);

  const verifiedRedemptions = useMemo(() => myRedemptions.filter(r => r.status === 'verified'), [myRedemptions]);
  const activeOffers = useMemo(
    () => myOffers.filter(o => getOfferLifecycleStatus(o) === 'Active'),
    [myOffers],
  );
  const totalPointsFromUsers = useMemo(
    () => myRedemptions.reduce((sum, r) => sum + (r.pointsSpent || 0), 0),
    [myRedemptions],
  );
  const uniqueVisitors = useMemo(() => {
    const ids = new Set(myRedemptions.map(r => r.userId));
    return ids.size;
  }, [myRedemptions]);

  const todayRedemptions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return myRedemptions.filter(r => r.redeemedAt.slice(0, 10) === today).length;
  }, [myRedemptions]);

  const todayVisitors = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const ids = new Set(myRedemptions.filter(r => r.redeemedAt.slice(0, 10) === today).map(r => r.userId));
    return ids.size;
  }, [myRedemptions]);

  const repeatVisitors = useMemo(() => {
    const counts: Record<string, number> = {};
    myRedemptions.forEach(r => { counts[r.userId] = (counts[r.userId] || 0) + 1; });
    return Object.values(counts).filter(c => c > 1).length;
  }, [myRedemptions]);

  const redemptionRate = useMemo(() => {
    if (myRedemptions.length === 0) return '0%';
    const pct = Math.round((verifiedRedemptions.length / myRedemptions.length) * 100);
    return `${pct}%`;
  }, [myRedemptions, verifiedRedemptions]);

  const avgConversion = useMemo(() => {
    if (activeOffers.length === 0) return '0%';
    const perOffer = activeOffers.map(o => {
      const reds = myRedemptions.filter(r => r.offerId === o.id).length;
      return reds;
    });
    const avg = perOffer.reduce((a, b) => a + b, 0) / perOffer.length;
    return avg < 1 ? '<1' : Math.round(avg).toString();
  }, [activeOffers, myRedemptions]);

  const handleCopyId = async () => {
    if (!currentVendor) return;
    const code =
      currentVendor.vendorCode ||
      `PAL-${currentVendor.id.slice(0, 8).toUpperCase()}`;
    const ok = await copyToClipboard(code, 'Vendor Code');
    if (ok) {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    }
  };

  const chartDateLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 6; i >= 1; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = d.getDate();
      const month = d.toLocaleString('en-US', { month: 'short' });
      labels.push(`${day} ${month}`);
    }
    labels.push('Today');
    return labels;
  }, []);

  const chartVisitorsData = useMemo(() => {
    const today = new Date();
    return chartDateLabels.map((label, idx) => {
      const targetDate = new Date();
      if (label === 'Today') {
        targetDate.setHours(0, 0, 0, 0);
      } else {
        targetDate.setDate(targetDate.getDate() - (6 - idx));
        targetDate.setHours(0, 0, 0, 0);
      }
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const dayRedemptions = myRedemptions.filter(r => {
        const rd = new Date(r.redeemedAt);
        return rd >= targetDate && rd < nextDate;
      });
      const visitors = dayRedemptions.length;
      const unique = new Set(dayRedemptions.map(r => r.userId)).size;
      return { visitors, unique };
    });
  }, [myRedemptions, chartDateLabels]);

  const chartMaxY = useMemo(() => {
    const max = Math.max(...chartVisitorsData.map(d => Math.max(d.visitors, d.unique)), 10);
    const rounded = Math.ceil(max / 50) * 50;
    return rounded || 50;
  }, [chartVisitorsData]);

  const chartYLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = chartMaxY; i >= 0; i -= chartMaxY / 4) {
      labels.push(Math.round(i).toString());
    }
    return labels;
  }, [chartMaxY]);

  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: showSidebar ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [showSidebar, sidebarAnim]);

  const toggleSidebar = () => setShowSidebar(prev => !prev);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: () => {
          setShowSidebar(false);
          onLogout?.();
        },
      },
    ]);
  };

  const sidebarTranslateX = sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH * 0.75, 0],
  });
  const overlayOpacity = sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0.92],
    extrapolate: 'clamp',
  });

  // Hooks must run unconditionally — never after an early return
  const displayAddress = useMemo(() => {
    if (!currentVendor) return '';
    const parts = [currentVendor.address, currentVendor.city, currentVendor.state].filter(Boolean);
    const unique: string[] = [];
    for (const p of parts) {
      const lower = p.trim().toLowerCase();
      if (!unique.some(u => u.toLowerCase() === lower)) {
        unique.push(p.trim());
      }
    }
    return unique.join(', ');
  }, [currentVendor]);

  const shortVendorId = useMemo(() => {
    if (!currentVendor) return '';
    const cityPart = (currentVendor.city || 'IND').slice(0, 3).toUpperCase();
    const catPart = (currentVendor.category || 'BIZ').slice(0, 4).toUpperCase();
    const numPart = currentVendor.id.slice(-4).toUpperCase();
    return `${cityPart}-${catPart}-${numPart}`;
  }, [currentVendor]);

  if (!currentVendor) {
    return (
      <SafeAreaView style={[s.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <Text style={{ color: COLORS.textMuted, fontSize: 16 }}>Loading vendor data...</Text>
      </SafeAreaView>
    );
  }

  const isApproved = currentVendor.verificationStatus === 'approved';
  const vendorCode = currentVendor.vendorCode || `PAL-${currentVendor.id.slice(0, 6).toUpperCase()}`;
  const category = currentVendor.category || 'business';
  const categoryEmoji = getVendorCategoryEmoji(category);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header — paddingTop from safe area insets (notch / Dynamic Island) */}
      <Animated.View style={[s.header, { opacity: headerOpacity, paddingTop: screenInsets.headerPadTop }]}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={toggleSidebar} style={s.headerBtn}>
            <MaterialIcons name="more-vert" size={24} color={COLORS.skyDeep} />
          </TouchableOpacity>
        </View>
        <View style={s.headerCenter}>
          <Text style={s.logoText}>PalSafar</Text>
          <Text style={s.vendorText}>Vendor</Text>
        </View>
      </Animated.View>

      {showNotifDropdown && (
        <NotificationsDropdown visible={showNotifDropdown} onClose={() => setShowNotifDropdown(false)} />
      )}

      {/* Sidebar Overlay */}
      {showSidebar && (
        <Animated.View style={[s.sidebarOverlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSidebar(false)} />
        </Animated.View>
      )}

      {/* Sidebar */}
      <Animated.View style={[s.sidebar, { transform: [{ translateX: sidebarTranslateX }], paddingTop: screenInsets.headerPadTop }]}>
        <View style={s.sidebarHeader}>
          <Text style={s.sidebarTitle}>Menu</Text>
          <TouchableOpacity onPress={() => setShowSidebar(false)} style={s.sidebarCloseBtn}>
            <MaterialIcons name="close" size={22} color={COLORS.skyDeep} />
          </TouchableOpacity>
        </View>

        <View style={s.sidebarDivider} />

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <TouchableOpacity
            style={s.sidebarItem}
            onPress={() => closeSidebarAnd(() => navigation.navigate('Notifications'))}
          >
            <Ionicons name="notifications-outline" size={20} color={COLORS.skyDark} />
            <Text style={s.sidebarItemText}>Notifications</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.sidebarItem}
            onPress={() => closeSidebarAnd(() => navigation.navigate('VendorSettings'))}
          >
            <Ionicons name="settings-outline" size={20} color={COLORS.skyDark} />
            <Text style={s.sidebarItemText}>Business settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.sidebarItem}
            onPress={() => closeSidebarAnd(() => navigation.navigate('LegalHub'))}
          >
            <Ionicons name="document-text-outline" size={20} color={COLORS.skyDark} />
            <Text style={s.sidebarItemText}>Terms & Conditions</Text>
          </TouchableOpacity>

          <View style={s.sidebarDivider} />

          <TouchableOpacity
            style={s.sidebarItem}
            onPress={() => closeSidebarAnd(() => navigation.navigate('VendorCustomers'))}
          >
            <Ionicons name="people-outline" size={20} color={COLORS.skyDark} />
            <Text style={s.sidebarItemText}>Customers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.sidebarItem}
            onPress={() => closeSidebarAnd(() => navigation.navigate('VendorSubscription'))}
          >
            <Ionicons name="card-outline" size={20} color={COLORS.skyDark} />
            <Text style={s.sidebarItemText}>Subscription & billing</Text>
          </TouchableOpacity>

          <View style={s.sidebarDivider} />

          <TouchableOpacity style={s.sidebarItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={[s.sidebarItemText, { color: '#EF4444' }]}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {visibleTab === 'Home' ? (
        <ScrollView
          style={s.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: screenInsets.scrollPadBottom }}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.sky} />
          }
        >
          {/* Pending approval */}
          {!isApproved && (
            <View style={[
              s.statusBanner,
              currentVendor.verificationStatus === 'rejected' ? s.statusBannerRejected : s.statusBannerPending,
            ]}>
              <MaterialIcons
                name={currentVendor.verificationStatus === 'rejected' ? 'cancel' : 'hourglass-top'}
                size={18}
                color={currentVendor.verificationStatus === 'rejected' ? '#FF5A5F' : COLORS.sky}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.statusBannerTitle}>
                  {currentVendor.verificationStatus === 'rejected' ? 'Verification rejected' : 'Awaiting verification'}
                </Text>
                <Text style={s.statusBannerText}>
                  {currentVendor.verificationStatus === 'rejected'
                    ? (currentVendor.rejectedReason || 'Contact support to resubmit your documents.')
                    : 'Your business is under review. Offers stay hidden until approved.'}
                </Text>
              </View>
            </View>
          )}

          {/* Hero Business Card */}
          <View style={s.heroCard}>
            <View style={s.heroCardInner}>
              <View style={s.heroTopRow}>
                <View style={[
                  s.verifiedBadge,
                  isApproved
                    ? s.verifiedBadgeApproved
                    : {
                        backgroundColor: currentVendor.verificationStatus === 'rejected' ? '#FF5A5F12' : '#B9834B12',
                        borderColor: currentVendor.verificationStatus === 'rejected' ? '#FF5A5F30' : '#B9834B30',
                      },
                ]}>
                  <MaterialIcons
                    name={isApproved ? 'verified' : currentVendor.verificationStatus === 'rejected' ? 'error' : 'schedule'}
                    size={13}
                    color={isApproved ? COLORS.success : currentVendor.verificationStatus === 'rejected' ? '#FF5A5F' : COLORS.sky}
                  />
                  <Text style={[
                    s.verifiedText,
                    isApproved
                      ? s.verifiedTextApproved
                      : { color: currentVendor.verificationStatus === 'rejected' ? '#FF5A5F' : COLORS.sky },
                  ]}>
                    {isApproved ? 'Verified Partner' : currentVendor.verificationStatus === 'rejected' ? 'Rejected' : 'Pending Review'}
                  </Text>
                </View>
                {currentVendor.showOnMap !== false && isApproved ? (
                  <Text style={s.mapVisibilityText}>On map</Text>
                ) : null}
              </View>

              <View style={s.heroBodyRow}>
                <View style={s.heroBodyLeft}>
                  <Text style={s.heroBusinessName} numberOfLines={2}>
                    {currentVendor.businessName}
                  </Text>
                  <Text style={s.heroCategoryText}>{categoryEmoji} {String(category).replace(/_/g, ' ')}</Text>

                  <View style={s.heroLocationRow}>
                    <Ionicons name="location-outline" size={13} color={COLORS.sky} />
                    <Text style={s.heroLocationText} numberOfLines={2}>{displayAddress}</Text>
                  </View>

                  <TouchableOpacity style={s.editProfileBtn} onPress={onViewProfile} activeOpacity={0.85}>
                    <Feather name="edit-2" size={11} color="#FFFFFF" />
                    <Text style={s.editProfileText}>View listing</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.heroBodyRight}>
                  <View style={s.heroAvatar}>
                    {currentVendor.imageUrl ? (
                      <Image source={{ uri: currentVendor.imageUrl }} style={s.heroAvatarImage} />
                    ) : (
                      <View style={s.heroAvatarAdd}>
                        <MaterialIcons name="add-photo-alternate" size={24} color={COLORS.sky} />
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={s.heroFooter}>
                <View style={s.heroFooterCodeBlock}>
                  <Text style={s.heroFooterLabel}>Business Code</Text>
                  <View style={s.heroFooterValueRow}>
                    <Text
                      style={s.heroFooterValue}
                      selectable
                    >
                      {showVendorCode
                        ? vendorCode
                        : `${vendorCode.slice(0, Math.min(8, vendorCode.length))}••••`}
                    </Text>
                    <TouchableOpacity
                      style={s.heroFooterAction}
                      onPress={() => setShowVendorCode(!showVendorCode)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name={showVendorCode ? 'eye-off-outline' : 'eye-outline'} size={14} color={COLORS.skyDark} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.heroFooterAction}
                      onPress={handleCopyId}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name={copiedId ? 'check' : 'content-copy'} size={14} color={copiedId ? COLORS.success : COLORS.skyDark} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={s.heroFooterDivider} />
                <View style={s.heroFooterOffersBlock}>
                  <Text style={s.heroFooterLabel}>Active offers</Text>
                  <Text style={s.heroFooterValueAccent}>{activeOffers.length}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={s.miniStatsCard}>
            <View style={[s.miniStatsGradient, { backgroundColor: COLORS.cardBg }]}>
              <Text style={s.snapshotHeading}>Business health</Text>
              <View style={s.miniStatsRow}>
                <View style={s.miniStatItem}>
                  <Text style={[s.miniStatValue, { color: COLORS.textPrimary }]}>
                    {Math.min(100, [
                      !!currentVendor.businessName,
                      !!currentVendor.address,
                      !!currentVendor.imageUrl,
                      isApproved,
                      activeOffers.length > 0,
                      !!(currentVendor as any).gstNumber || !!(currentVendor as any).phone,
                    ].filter(Boolean).length * 17)}%
                  </Text>
                  <Text style={[s.miniStatLabel, { color: COLORS.textSecondary }]}>Profile</Text>
                </View>
                <View style={[s.miniStatDivider, { backgroundColor: COLORS.border }]} />
                <View style={s.miniStatItem}>
                  <Text style={[s.miniStatValue, { color: COLORS.textPrimary }]}>{activeOffers.length}</Text>
                  <Text style={[s.miniStatLabel, { color: COLORS.textSecondary }]}>Live offers</Text>
                </View>
                <View style={[s.miniStatDivider, { backgroundColor: COLORS.border }]} />
                <View style={s.miniStatItem}>
                  <Text style={[s.miniStatValue, { color: COLORS.textPrimary }]}>
                    {redemptions.filter((r) => r.vendorId === currentVendor.id).length}
                  </Text>
                  <Text style={[s.miniStatLabel, { color: COLORS.textSecondary }]}>Customers</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Today's snapshot */}
          <View style={s.miniStatsCard}>
            <View style={[s.miniStatsGradient, { backgroundColor: COLORS.cardBg }]}>
              <Text style={s.snapshotHeading}>Today</Text>
              <View style={s.miniStatsRow}>
                <View style={s.miniStatItem}>
                  <Text style={[s.miniStatValue, { color: COLORS.textPrimary }]}>
                    {dashStats?.todayRedemptions ?? todayRedemptions}
                  </Text>
                  <Text style={[s.miniStatLabel, { color: COLORS.textSecondary }]}>Redemptions</Text>
                </View>
                <View style={[s.miniStatDivider, { backgroundColor: COLORS.border }]} />
                <View style={s.miniStatItem}>
                  <Text style={[s.miniStatValue, { color: COLORS.textPrimary }]}>
                    {dashStats?.totalViews ?? todayVisitors}
                  </Text>
                  <Text style={[s.miniStatLabel, { color: COLORS.textSecondary }]}>Offer views</Text>
                </View>
                <View style={[s.miniStatDivider, { backgroundColor: COLORS.border }]} />
                <View style={s.miniStatItem}>
                  <Text style={[s.miniStatValue, { color: COLORS.textPrimary }]}>{activeOffers.length}</Text>
                  <Text style={[s.miniStatLabel, { color: COLORS.textSecondary }]}>Live offers</Text>
                </View>
              </View>
              {dashStats != null ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                  <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>
                    Clicks {dashStats.totalClicks ?? 0}
                  </Text>
                  <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>
                    Conv. {dashStats.conversionRate ?? 0}%
                  </Text>
                  {(dashStats.pendingApproval ?? 0) > 0 ? (
                    <Text style={{ fontSize: 11, color: COLORS.warning, fontWeight: '600' }}>
                      {dashStats.pendingApproval} pending
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          {/* Redemption trend (from real redemptions data) */}
          <View style={s.sectionWrap}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>7-day activity</Text>
              <TouchableOpacity style={s.insightsViewAllBtn} onPress={onViewAnalytics}>
                <Text style={s.insightsViewAllText}>Full analytics</Text>
                <MaterialIcons name="arrow-forward-ios" size={10} color={COLORS.sky} />
              </TouchableOpacity>
            </View>
            <View style={s.insightsCard}>
              <View style={s.insightsChartHeader}>
                <View style={s.insightsHeaderLeft}>
                  <View style={s.insightsHeaderIcon}>
                    <MaterialIcons name="bar-chart" size={18} color={COLORS.skyDeep} />
                  </View>
                  <View style={s.insightsTitleRow}>
                    <Text style={s.insightsChartTitle}>Redemptions</Text>
                    <Text style={s.insightsChartSubtitle}>Last 7 days</Text>
                  </View>
                </View>
              </View>

              {/* Dual Line Chart */}
              <View style={s.chartContainer}>
                {/* Y-axis labels */}
                <View style={s.chartYAxis}>
                  {chartYLabels.map((label) => (
                    <Text key={label} style={s.chartYLabel}>{label}</Text>
                  ))}
                </View>
                {/* Chart area */}
                <View style={s.chartArea}>
                  {/* Grid lines */}
                  {chartYLabels.map((_, i) => (
                    <View key={i} style={[s.chartGridLine, { top: `${(i / (chartYLabels.length - 1)) * 100}%` }]} />
                  ))}
                  {/* Data lines & dots - Visitors (dark teal) */}
                  {chartVisitorsData.map((d, i) => (
                    <View
                      key={`v-${i}`}
                      style={[s.chartDot, {
                        left: `${(i / (chartVisitorsData.length - 1)) * 90 + 5}%`,
                        bottom: `${(d.visitors / chartMaxY) * 100}%`,
                        backgroundColor: '#8B6B3A',
                        borderColor: '#8B6B3A',
                        width: 8, height: 8,
                      }]}
                    />
                  ))}
                  {/* Data lines & dots - Unique (light cyan) */}
                  {chartVisitorsData.map((d, i) => (
                    <View
                      key={`u-${i}`}
                      style={[s.chartDot, {
                        left: `${(i / (chartVisitorsData.length - 1)) * 90 + 5}%`,
                        bottom: `${(d.unique / chartMaxY) * 100}%`,
                        backgroundColor: '#D4A87A',
                        borderColor: '#D4A87A',
                        width: 6, height: 6,
                      }]}
                    />
                  ))}
                  {/* X-axis labels */}
                  <View style={s.chartXAxis}>
                    {chartDateLabels.map((label) => (
                      <Text key={label} style={s.chartXLabel}>{label}</Text>
                    ))}
                  </View>
                </View>
              </View>

              {/* Legend */}
              <View style={s.chartLegendRow}>
                <View style={s.legendCapsule}>
                  <View style={[s.legendDot, { backgroundColor: '#8B6B3A' }]} />
                  <Text style={s.legendText}>Redemptions</Text>
                </View>
                <View style={s.legendCapsule}>
                  <View style={[s.legendDot, { backgroundColor: '#D4A87A' }]} />
                  <Text style={s.legendText}>Unique customers</Text>
                </View>
              </View>

              <View style={s.insightsDivider} />

              {/* Single KPI Card with 4 Partitions (2x2) */}
              <View style={s.kpiSingleCard}>
                <View style={s.kpiRow}>
                  <View style={s.kpiPartition}>
                    <Text style={s.kpiLabel}>Repeat Visitors</Text>
                    <Text style={s.kpiValue}>{repeatVisitors}</Text>
                  </View>
                  <View style={s.kpiDividerVer} />
                  <View style={s.kpiPartition}>
                    <Text style={s.kpiLabel}>New Visitors</Text>
                    <Text style={s.kpiValue}>{uniqueVisitors - repeatVisitors}</Text>
                  </View>
                </View>
                <View style={s.kpiDividerHor} />
                <View style={s.kpiRow}>
                  <View style={s.kpiPartition}>
                    <Text style={s.kpiLabel}>Redemption Rate</Text>
                    <Text style={s.kpiValue}>{redemptionRate}</Text>
                  </View>
                  <View style={s.kpiDividerVer} />
                  <View style={s.kpiPartition}>
                    <Text style={s.kpiLabel}>Avg Offer Conversion</Text>
                    <Text style={s.kpiValue}>{avgConversion}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Guidance / next steps */}
          <View style={s.sectionWrap}>
            <View style={s.guideCard}>
              <Text style={s.guideTitle}>Grow with PalSafar</Text>
              <Text style={s.guideText}>
                {myOffers.length === 0
                  ? 'Create your first offer so tourists nearby can discover your business.'
                  : myRedemptions.length === 0
                  ? 'Share your business code so visitors can send you PalPoints instantly.'
                  : 'Keep offers fresh — tourists can also send PalPoints with your business code.'}
              </Text>
              <View style={s.guideActions}>
                <TouchableOpacity style={s.guideBtnPrimary} onPress={onCreateOffer} activeOpacity={0.85}>
                  <Text style={s.guideBtnPrimaryText}>
                    {myOffers.length === 0 ? 'Create first offer' : 'New offer'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </ScrollView>
      ) : visibleTab === 'Offers' ? (
        <OffersView
          onCreateOffer={onCreateOffer}
          onEditOffer={onEditOffer}
          totalOffers={myOffers.length}
          activeOffers={activeOffers.length}
          totalRedemptions={myRedemptions.length}
          pointsRedeemed={totalPointsFromUsers}
          offers={myOffers}
          refreshing={refreshing}
          onRefresh={onRefresh}
          scrollPadBottom={screenInsets.scrollPadBottom}
        />
      ) : null}

      {/* Bottom Navigation — hidden when VendorTabs owns chrome */}
      {!hideBottomNav ? (
      <View style={s.bottomNav}>
        {NAV_ITEMS.map((item) => {
          const isActive = visibleTab === item.key;
          const IconComp =
            item.iconSet === 'Feather' ? Feather :
            item.iconSet === 'Ionicons' ? Ionicons :
            MaterialIcons;
          const onTabPress = () => {
            setActiveTab(item.key as typeof activeTab);
            if (item.key === 'Home') { /* already here */ }
            if (item.key === 'Analytics') onViewAnalytics?.();
            if (item.key === 'Profile') onViewProfile?.();
          };
          return (
            <TouchableOpacity key={item.key} style={s.navItem} onPress={onTabPress}>
              <IconComp
                name={item.icon}
                size={22}
                color={isActive ? COLORS.sky : COLORS.textMuted}
              />
              {isActive && <View style={s.navActiveDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
      ) : null}

    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollView: {
    flex: 1,
  },

  // Header — paddingTop applied at runtime via useSafeAreaInsets
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: VendorUI.space.screen,
    paddingBottom: VendorUI.space.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 10,
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.skyPale,
  },
  notifDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.skyDeep,
    letterSpacing: -0.5,
  },
  vendorText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.sky,
    letterSpacing: -0.5,
  },


  // Sidebar
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 50,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: Math.min(SCREEN_WIDTH * 0.78, 320),
    maxWidth: '85%',
    backgroundColor: COLORS.white,
    zIndex: 51,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.skyDeep,
  },
  sidebarCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.skyPale,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
    marginVertical: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  sidebarItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  // Notifications Dropdown
  notifDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 60,
    right: 16,
    left: 16,
    maxHeight: 420,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notifHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.skyDeep,
  },
  notifBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  notifCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.skyPale,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  notifDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  notifTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  notifUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginTop: 6,
    marginLeft: 8,
  },
  notifFooter: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifFooterBtn: {
    paddingVertical: 4,
  },
  notifFooterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.sky,
  },

  // Hero Card — clean full-white profile surface
  heroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: CARD_RADIUS,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#2C1810',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(185, 131, 75, 0.22)',
  },
  heroCardInner: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 0,
    backgroundColor: '#FFFFFF',
  },
  heroDecoCircle1: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.sky + '0D',
  },
  heroDecoCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.skyLight + '30',
  },
  heroTopRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#B9834B12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#B9834B28',
    alignSelf: 'flex-start',
  },
  verifiedBadgeApproved: {
    backgroundColor: '#6B8F7112',
    borderColor: '#6B8F7130',
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.sky,
    letterSpacing: 0.2,
  },
  verifiedTextApproved: {
    color: COLORS.success,
  },
  heroBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
  },
  heroBodyLeft: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  heroBodyRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatar: {
    width: 84,
    height: 84,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2C1810',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(185, 131, 75, 0.28)',
    overflow: 'hidden',
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  heroAvatarAdd: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.skyVeryPale,
  },
  heroBusinessName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  heroRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 14,
  },
  heroLocationText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 17,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.sky,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    alignSelf: 'flex-start',
  },
  editProfileText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroFooter: {
    marginTop: 16,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(185, 131, 75, 0.14)',
    gap: 12,
  },
  heroFooterCodeBlock: {
    width: '100%',
  },
  heroFooterOffersBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroFooterItem: {
    flex: 1,
    minWidth: 0,
  },
  heroFooterItemRight: {
    alignItems: 'flex-end',
  },
  heroFooterLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  heroFooterValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  heroFooterValue: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  heroFooterValueAccent: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.skyDeep,
    letterSpacing: -0.4,
  },
  heroFooterAction: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.skyVeryPale,
    borderWidth: 1,
    borderColor: 'rgba(185, 131, 75, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFooterDivider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(185, 131, 75, 0.12)',
  },

  // Mini Stats Card
  miniStatsCard: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: COLORS.sky,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  miniStatsGradient: {
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  miniStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  miniStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  miniStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Sections
  sectionWrap: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.skyDeep,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.sky,
    backgroundColor: COLORS.skyPale,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.sky,
  },
  createOfferBtn: {
    borderRadius: 24,
    overflow: 'hidden',
    height: 130,
    shadowColor: '#B9834B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  createOfferGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  coDecoCircle1: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  coDecoCircle2: {
    position: 'absolute',
    bottom: -40,
    left: 80,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  coLeftContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coGiftBox: {
    width: 60,
    height: 60,
    alignItems: 'center',
  },
  coGiftLid: {
    width: 60,
    height: 14,
    backgroundColor: '#8B6B3A',
    borderRadius: 4,
    position: 'relative',
    alignItems: 'center',
  },
  coGiftRibbonH: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#FBEFE2',
    borderRadius: 2,
  },
  coGiftBow: {
    position: 'absolute',
    top: -7,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FBEFE2',
  },
  coGiftBody: {
    width: 60,
    height: 46,
    backgroundColor: '#B9834B',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coGiftRibbonV: {
    width: 5,
    height: 46,
    backgroundColor: '#FBEFE2',
    borderRadius: 2,
  },
  coRightContent: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '70%',
  },
  coTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  coTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2C1810',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  coPlus: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B6B3A',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FBEFE2',
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
    marginLeft: 6,
  },
  coSubtitle: {
    fontSize: 12,
    color: '#63300E',
    lineHeight: 16,
    textAlign: 'center',
  },

  // Performance Cards Grid
  perfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  performanceCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  perfIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  perfValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.skyDeep,
    letterSpacing: -0.5,
  },
  perfLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Insights Card
  insightsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  insightsChartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  insightsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  insightsHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.skyPale,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightsTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  insightsChartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.skyDeep,
    letterSpacing: -0.3,
  },
  insightsChartSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  insightsViewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  insightsViewAllText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.sky,
  },
  chartContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    height: 160,
    marginBottom: 8,
  },
  chartYAxis: {
    width: 30,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  chartYLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#B8A88A',
    textAlign: 'right',
    paddingRight: 8,
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    paddingBottom: 24,
  },
  chartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#FBEFE2',
  },
  chartDot: {
    position: 'absolute',
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#FFF9F2',
    shadowColor: '#63300E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginLeft: -4,
    marginBottom: -4,
  },
  chartXAxis: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  chartXLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: '#B8A88A',
  },
  chartLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 16,
  },
  legendCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FBEFE2',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  insightsDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
  },
  kpiSingleCard: {
    backgroundColor: COLORS.skyPale,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kpiPartition: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 2,
  },
  kpiDividerVer: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
  kpiDividerHor: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.skyDeep,
    letterSpacing: -0.5,
  },

  // Redemption Cards
  redemptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  redemptionLeft: {
    marginRight: 12,
  },
  touristAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.skyPale,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redemptionCenter: {
    flex: 1,
  },
  touristName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  rewardName: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  redemptionTime: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  redemptionRight: {
    alignItems: 'flex-end',
  },
  pointsUsed: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.sky,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyRedemptions: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // Promotion Banner
  promoBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
  },
  promoGradient: {
    padding: 16,
    position: 'relative',
  },
  promoDecoCircle1: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  promoDecoCircle2: {
    position: 'absolute',
    bottom: 80,
    left: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(197,222,222,0.4)',
  },
  promoDecoCircle3: {
    position: 'absolute',
    top: 100,
    right: 40,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  promoIllustrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 16,
  },
  promoPhoneWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoPhoneBody: {
    width: 52,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2D2D44',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  promoPhoneScreen: {
    width: 44,
    height: 76,
    borderRadius: 8,
    backgroundColor: '#0F0F23',
    overflow: 'hidden',
  },
  promoPhoneNotch: {
    width: 20,
    height: 4,
    backgroundColor: '#1A1A2E',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 4,
  },
  promoPhoneContent: {
    flex: 1,
    padding: 4,
    gap: 3,
    justifyContent: 'center',
  },
  promoPhoneShopIcon: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#B9834B',
    alignSelf: 'center',
    marginBottom: 2,
  },
  promoPhoneReelBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4A87A',
    width: '80%',
    alignSelf: 'center',
  },
  promoPhoneReelBar2: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#8B6B3A',
    width: '60%',
    alignSelf: 'center',
  },
  promoMegaphone: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  promoFloatingIcons: {
    flexDirection: 'column',
    gap: 6,
  },
  promoFloatIcon: {
    fontSize: 16,
  },
  promoPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(200,132,24,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(200,132,24,0.15)',
  },
  promoPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.skyDeep,
  },
  promoHeadline: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.skyDeep,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  promoSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  promoFeatureCards: {
    gap: 6,
    marginBottom: 16,
  },
  promoFeatureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  promoFeatureIcon: {
    fontSize: 18,
  },
  promoFeatureInfo: {
    flex: 1,
  },
  promoFeatureTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.skyDeep,
    marginBottom: 1,
  },
  promoFeatureDesc: {
    fontSize: 10,
    color: COLORS.textMuted,
    lineHeight: 13,
  },
  promoGlassTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B9834B',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  promoCtaBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: COLORS.sky,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  promoCtaBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF9F2',
    letterSpacing: 0.5,
  },
  promoFooter: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B8A88A',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginTop: 16,
  },

  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  navActiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.sky,
    marginTop: 4,
  },

  // Offers View
  OvHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
  },
  OvHeaderLeft: { flex: 1, marginRight: 16 },
  OvTitle: { fontSize: 24, fontWeight: '800', color: COLORS.sky, letterSpacing: -0.5, marginBottom: 2 },
  OvSubtitle: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 16 },
  OvCreateBtn: {
    height: 38, borderRadius: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.textPrimary,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  OvCreateBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  OvStatsGrid: {
    flexDirection: 'row', paddingHorizontal: 20,
    gap: 8, marginTop: 14,
  },
  OvStatCard: {
    width: (SCREEN_WIDTH - 40 - 24) / 4,
    borderRadius: CARD_RADIUS,
    shadowColor: COLORS.sky, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  OvStatGradient: {
    padding: 12, alignItems: 'center', position: 'relative',
    minHeight: 90,
  },
  OvStatIcon: {
    width: 28, height: 28, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  OvStatValue: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3, marginBottom: 1 },
  OvStatLabel: { fontSize: 9, fontWeight: '500', color: COLORS.textMuted },

  OvFilterCard: {
    marginHorizontal: 20, marginTop: 24,
    backgroundColor: COLORS.white, borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, shadowRadius: 12, elevation: 3,
    borderWidth: 1, borderColor: COLORS.border,
  },
  OvFilterSection: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 4,
  },
  OvFilterRow: { flexDirection: 'row', gap: 4 },
  OvFilterTab: {
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12,
    position: 'relative',
  },
  OvFilterText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  OvFilterTextActive: { color: COLORS.sky, fontWeight: '700' },
  OvFilterLine: {
    position: 'absolute', bottom: 2, left: 18, right: 18, height: 3,
    backgroundColor: COLORS.sky, borderRadius: 2,
  },
  OvFilterBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: COLORS.skyPale, justifyContent: 'center', alignItems: 'center',
    marginLeft: 6,
  },
  filterDescCard: {
    marginHorizontal: 20, marginTop: 16,
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1,
  },
  filterDescLeft: { flex: 1, marginRight: 12 },
  filterDescHeading: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  filterDescText: { fontSize: 11, color: COLORS.textMuted, lineHeight: 15 },
  filterDescIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  OvCard: {
    marginHorizontal: 20, marginTop: 12,
    backgroundColor: COLORS.white, borderRadius: 18,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8, shadowRadius: 16, elevation: 4,
    borderWidth: 1.5, borderColor: COLORS.border + '60', overflow: 'hidden',
  },
  OvCardRow: { flexDirection: 'row', padding: 16 },
  OvImgWrap: {
    width: 110, height: 110, borderRadius: 18, overflow: 'hidden',
    position: 'relative',
    borderWidth: 2, borderColor: COLORS.skyLight + '30',
  },
  OvImgPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: COLORS.skyPale,
    justifyContent: 'center', alignItems: 'center',
  },
  OvBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: COLORS.sky,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
    shadowColor: COLORS.skyDark, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  OvBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: -0.2 },
  OvCardBody: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, gap: 6 },
  OvChipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  OvMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  OvInfo: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, gap: 4 },
  OvChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    alignSelf: 'flex-start',
  },
  OvDot: { width: 7, height: 7, borderRadius: 4 },
  OvChipText: { fontSize: 11, fontWeight: '800' },
  OvCardTitle: {
    fontSize: 18, fontWeight: '800', color: COLORS.textPrimary,
    letterSpacing: -0.4, marginTop: 2,
  },
  OvMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  OvMetaText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  OvStatsMini: {
    width: 90, alignItems: 'center',
    backgroundColor: COLORS.skyPale,
    borderRadius: 10, paddingVertical: 6, gap: 2,
    borderWidth: 1, borderColor: COLORS.skyLight + '20',
  },
  OvStatsMiniVal: { fontSize: 14, fontWeight: '900', color: COLORS.textPrimary },
  OvStatsMiniLbl: { fontSize: 9, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  OvActionRow: {
    flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap',
    paddingVertical: 8, paddingHorizontal: 8,
    borderTopWidth: 1, borderTopColor: COLORS.skyLight + '25',
    backgroundColor: COLORS.skyVeryPale,
    gap: 4,
  },
  OvActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.skyLight + '20',
  },
  OvActionText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },

  // Home dashboard polish
  statusBanner: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 14, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    borderWidth: 1,
  },
  statusBannerPending: { backgroundColor: '#B9834B12', borderColor: '#B9834B40' },
  statusBannerRejected: { backgroundColor: '#FF5A5F12', borderColor: '#FF5A5F40' },
  statusBannerTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  statusBannerText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  mapVisibilityText: {
    fontSize: 11, fontWeight: '700', color: COLORS.success,
    backgroundColor: '#6B8F7114', paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, borderColor: '#6B8F7130', overflow: 'hidden',
  },
  heroCategoryText: {
    fontSize: 12, color: COLORS.skyDark, fontWeight: '600',
    textTransform: 'capitalize', marginTop: 2, marginBottom: 8,
  },
  snapshotHeading: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  guideCard: {
    backgroundColor: COLORS.white, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  guideTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  guideText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 14 },
  guideActions: { flexDirection: 'row', gap: 10 },
  guideBtnPrimary: {
    flex: 1, backgroundColor: COLORS.sky, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  guideBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  guideBtnSecondary: {
    flex: 1, backgroundColor: COLORS.skyPale, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  guideBtnSecondaryText: { color: COLORS.skyDeep, fontWeight: '700', fontSize: 13 },
  emptyCta: {
    marginTop: 12, backgroundColor: COLORS.skyPale, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  emptyCtaText: { color: COLORS.skyDeep, fontWeight: '700', fontSize: 13 },
  OvFilterHint: {
    marginHorizontal: 16, marginBottom: 10, marginTop: 2,
    fontSize: 12, color: COLORS.textSecondary, fontWeight: '600',
  },
});
