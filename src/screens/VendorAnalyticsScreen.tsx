import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, borderRadius } from '../config/theme';
import { Ionicons, MaterialIcons } from '../utils/Icons';
import { redemptionsApi, ServerRedemption, vendorsApi } from '../services/api';
import { useVendorScreenInsets, VendorUI } from '../design/vendorLayout';

const colors = {
  background: '#FFF9F2',
  white: '#FFFFFF',
  surface: '#FBEFE2',
  text: '#2C1810',
  textSecondary: '#8B7355',
  textMuted: '#B8A88A',
  primary: '#B9834B',
  primaryDark: '#63300E',
  success: '#6B8F71',
  border: 'rgba(200, 155, 60, 0.2)',
};

interface VendorAnalyticsScreenProps {
  onBack: () => void;
  vendorId: string;
  vendorName: string;
}

type DateRange = 7 | 30 | 90;

const PERIODS: { days: DateRange; label: string }[] = [
  { days: 7, label: 'This week' },
  { days: 30, label: 'This month' },
  { days: 90, label: '3 months' },
];

export default function VendorAnalyticsScreen({ onBack, vendorId, vendorName }: VendorAnalyticsScreenProps) {
  const screenInsets = useVendorScreenInsets({ withTabBar: true });
  const [dateRange, setDateRange] = useState<DateRange>(30);
  const [redemptions, setRedemptions] = useState<ServerRedemption[]>([]);
  const [peopleSawOffers, setPeopleSawOffers] = useState(0);
  const [peopleTappedOffers, setPeopleTappedOffers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const period = dateRange === 7 ? '7d' : dateRange === 90 ? '90d' : '30d';
      const [redRes, analyticsRes, dashRes] = await Promise.all([
        redemptionsApi.vendorRedemptions(1, 200),
        vendorsApi.getAnalytics(period),
        vendorsApi.getDashboard(),
      ]);

      const data: ServerRedemption[] = Array.isArray(redRes)
        ? redRes
        : (redRes as any).data ?? (redRes as any).redemptions ?? [];
      setRedemptions(data);

      const analytics = (analyticsRes as any)?.data ?? analyticsRes;
      const dashboard = (dashRes as any)?.data ?? dashRes;
      const views =
        analytics?.overview?.totalViews ??
        analytics?.totalViews ??
        analytics?.stats?.totalViews ??
        dashboard?.stats?.totalViews ??
        0;
      const clicks =
        analytics?.overview?.totalClicks ??
        analytics?.totalClicks ??
        analytics?.stats?.totalClicks ??
        dashboard?.stats?.totalClicks ??
        0;
      setPeopleSawOffers(Number(views) || 0);
      setPeopleTappedOffers(Number(clicks) || 0);
    } catch (e: any) {
      setError(e?.message || 'Could not load analytics');
      setRedemptions([]);
      setPeopleSawOffers(0);
      setPeopleTappedOffers(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, dateRange]);

  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - dateRange);
    return redemptions.filter(r => new Date(r.createdAt) >= cutoff);
  }, [redemptions, dateRange]);

  const summary = useMemo(() => {
    const usedOffers = filtered.length;
    const customers = new Set(filtered.map(r => r.userId)).size;
    const pointsReceived = filtered.reduce((sum, r) => sum + (r.pointsSpent || 0), 0);

    const returnCounts: Record<string, number> = {};
    filtered.forEach(r => {
      returnCounts[r.userId] = (returnCounts[r.userId] || 0) + 1;
    });
    const cameBack = Object.values(returnCounts).filter(c => c > 1).length;

    const offerCounts: Record<string, number> = {};
    filtered.forEach(r => {
      const name = r.offerTitle || r.offer?.title || 'Offer';
      offerCounts[name] = (offerCounts[name] || 0) + 1;
    });
    let bestOffer = '';
    let bestCount = 0;
    Object.entries(offerCounts).forEach(([name, count]) => {
      if (count > bestCount) {
        bestCount = count;
        bestOffer = name;
      }
    });

    return { usedOffers, customers, pointsReceived, cameBack, bestOffer, bestCount };
  }, [filtered]);

  const recent = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
    [filtered],
  );

  const periodLabel = PERIODS.find(p => p.days === dateRange)?.label ?? 'This month';

  const tip =
    summary.usedOffers === 0
      ? 'No one has used your offers yet in this period. Share an offer with customers nearby to get started.'
      : summary.cameBack > 0
      ? `${summary.cameBack} customer${summary.cameBack === 1 ? '' : 's'} came back again — keep popular offers running.`
      : 'People are using your offers. Add a new one next week to bring them back.';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: screenInsets.scrollPadBottom }}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryDark} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Your business stats</Text>
          <Text style={styles.vendorName}>{vendorName}</Text>
        </View>
      </View>

      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.days}
            style={[styles.periodTab, dateRange === p.days && styles.periodTabActive]}
            onPress={() => setDateRange(p.days)}
            activeOpacity={0.85}
          >
            <Text style={[styles.periodTabText, dateRange === p.days && styles.periodTabTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Getting your numbers…</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>{error}</Text>
          <TouchableOpacity
            onPress={loadAnalytics}
            style={{ marginTop: 12, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Plain-language hero */}
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>{periodLabel}</Text>
            <Text style={styles.heroNumber}>{summary.usedOffers}</Text>
            <Text style={styles.heroLabel}>
              {summary.usedOffers === 1 ? 'person used your offer' : 'people used your offers'}
            </Text>
            <Text style={styles.heroSub}>
              {summary.customers === 0
                ? 'Waiting for your first customer'
                : `From ${summary.customers} different customer${summary.customers === 1 ? '' : 's'}`}
            </Text>
          </View>

          {/* 4 simple facts */}
          <Text style={styles.blockTitle}>At a glance</Text>
          <View style={styles.factList}>
            <FactRow
              icon="visibility"
              title="Saw your offers"
              value={String(peopleSawOffers)}
              hint="How many times people looked at your deals"
            />
            <FactRow
              icon="touch-app"
              title="Opened an offer"
              value={String(peopleTappedOffers)}
              hint="How many times people tapped for details"
            />
            <FactRow
              icon="stars"
              title="PalPoints received"
              value={String(summary.pointsReceived)}
              hint="Points customers spent at your place"
            />
            <FactRow
              icon="favorite"
              title="Came back again"
              value={String(summary.cameBack)}
              hint="Customers who used more than one offer"
              last
            />
          </View>

          {/* Best offer */}
          {summary.bestOffer ? (
            <View style={styles.bestCard}>
              <View style={styles.bestIcon}>
                <MaterialIcons name="emoji-events" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bestTitle}>Most popular offer</Text>
                <Text style={styles.bestName} numberOfLines={2}>{summary.bestOffer}</Text>
                <Text style={styles.bestHint}>
                  Used {summary.bestCount} time{summary.bestCount === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Recent activity — plain language */}
          <Text style={styles.blockTitle}>Latest activity</Text>
          {recent.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialIcons name="receipt-long" size={36} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Nothing yet</Text>
              <Text style={styles.emptyHint}>
                When a tourist uses your offer, it will show up here.
              </Text>
            </View>
          ) : (
            <View style={styles.activityList}>
              {recent.map((r, i) => {
                const name = (r as any).user?.name || 'A customer';
                const offer = r.offerTitle || r.offer?.title || 'your offer';
                const when = new Date(r.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                });
                return (
                  <View
                    key={r.id}
                    style={[styles.activityRow, i === recent.length - 1 && styles.activityRowLast]}
                  >
                    <View style={styles.activityAvatar}>
                      <MaterialIcons name="person" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {name} used “{offer}”
                      </Text>
                      <Text style={styles.activityMeta}>
                        {r.pointsSpent} points · {when}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.tipCard}>
            <MaterialIcons name="lightbulb" size={20} color={colors.primary} />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        </>
      )}

      </ScrollView>
    </SafeAreaView>
  );
}

function FactRow({
  icon,
  title,
  value,
  hint,
  last,
}: {
  icon: string;
  title: string;
  value: string;
  hint: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.factRow, last && styles.factRowLast]}>
      <View style={styles.factIcon}>
        <MaterialIcons name={icon as any} size={20} color={colors.primaryDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.factTitle}>{title}</Text>
        <Text style={styles.factHint}>{hint}</Text>
      </View>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: VendorUI.space.screen,
    paddingTop: VendorUI.space.sm,
    paddingBottom: VendorUI.space.md,
  },
  backBtn: {
    width: VendorUI.headerBtnSize,
    height: VendorUI.headerBtnSize,
    borderRadius: VendorUI.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerText: { flex: 1, marginLeft: spacing.sm, minWidth: 0 },
  title: { ...VendorUI.typography.title, color: colors.text },
  vendorName: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: VendorUI.space.screen,
    gap: VendorUI.space.sm,
    marginBottom: spacing.md,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodTabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  periodTabTextActive: { color: '#FFFFFF' },

  loadingBox: { paddingVertical: 80, alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.textMuted },

  heroCard: {
    marginHorizontal: VendorUI.space.screen,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(185,131,75,0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 4,
    lineHeight: 62,
  },
  heroLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: 4,
  },
  heroSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },

  blockTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginHorizontal: spacing.lg,
    marginTop: 22,
    marginBottom: 10,
  },

  factList: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  factRowLast: { borderBottomWidth: 0 },
  factIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  factHint: { fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 15 },
  factValue: { fontSize: 20, fontWeight: '800', color: colors.primaryDark },

  bestCard: {
    marginHorizontal: spacing.lg,
    marginTop: 16,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bestIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestTitle: { fontSize: 12, fontWeight: '700', color: colors.primary },
  bestName: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
  bestHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  emptyCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 10 },
  emptyHint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  activityList: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityRowLast: { borderBottomWidth: 0 },
  activityAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  activityMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: spacing.lg,
    marginTop: 20,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
});
