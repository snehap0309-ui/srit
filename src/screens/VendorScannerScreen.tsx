import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '../utils/Icons';
import { redemptionsApi } from '../services/api/redemptions';
import type { ServerRedemption } from '../services/api/redemptions';
import { useDataContext } from '../context/DataContext';
import { DEV_FLAGS } from '../config/devFlags';
import { useVendorScreenInsets, VendorUI } from '../design/vendorLayout';

interface VendorScannerScreenProps {
  vendorName: string;
}

export default function VendorScannerScreen({ vendorName }: VendorScannerScreenProps) {
  const screenInsets = useVendorScreenInsets();
  const { currentVendor, redemptions } = useDataContext();
  const [history, setHistory] = useState<ServerRedemption[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const localHistory = useMemo(() => redemptions
    .filter((item) => item.vendorId === currentVendor?.id)
    .map((item) => ({
      id: item.id,
      userId: item.userId,
      vendorId: item.vendorId,
      offerId: item.offerId,
      pointsSpent: item.pointsSpent || 0,
      discountValue: item.discountReceived || 0,
      discountType: 'FLAT' as const,
      qrCode: item.verificationCode || '',
      receiptNumber: null,
      status: item.status === 'verified' ? 'VERIFIED' : item.status === 'cancelled' ? 'CANCELLED' : 'PENDING',
      verifiedAt: item.verifiedAt || null,
      verifiedById: null,
      refundedAt: null,
      notes: null,
      createdAt: item.redeemedAt,
      updatedAt: item.redeemedAt,
      offerTitle: item.offerTitle,
      user: item.userName ? { name: item.userName } : undefined,
    } as ServerRedemption))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [currentVendor?.id, redemptions]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      if (!DEV_FLAGS.USE_SERVER_API) {
        setHistory(localHistory);
        return;
      }
      const response = await redemptionsApi.vendorRedemptions(1, 100);
      if (response.success && Array.isArray(response.data)) {
        setHistory(response.data);
      } else if (Array.isArray((response as any)?.data)) {
        setHistory((response as any).data);
      } else {
        setHistory(localHistory);
      }
    } catch {
      setHistory(localHistory);
    } finally {
      setHistoryLoading(false);
    }
  }, [localHistory]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchHistory();
    } finally {
      setRefreshing(false);
    }
  }, [fetchHistory]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Match the former Home chip: points received through this vendor's redemptions.
  const totalPoints = redemptions
    .filter((item) => item.vendorId === currentVendor?.id)
    .reduce((sum, item) => sum + (item.pointsSpent || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={VendorUI.colors.bg} />
      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>PalPoints</Text>
          <Text style={styles.subtitle}>{vendorName}</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <MaterialIcons name="stars" size={24} color={VendorUI.colors.primaryDark} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={styles.summaryLabel}>PalPoints received from tourists</Text>
          <Text style={styles.summaryValue}>{totalPoints} pts</Text>
          <Text style={styles.summaryHint}>
            Tourists send points using your business code — no QR scan needed.
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.historyScroll}
        contentContainerStyle={[styles.historyContent, { paddingBottom: screenInsets.scrollPadBottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={VendorUI.colors.primary}
            colors={[VendorUI.colors.primary]}
          />
        }
      >
        <Text style={styles.historyTitle}>PalPoints history</Text>
        {historyLoading && history.length === 0 ? (
          <View style={styles.historyLoading}>
            <ActivityIndicator size="large" color={VendorUI.colors.primary} />
          </View>
        ) : history.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={48} color={VendorUI.colors.textMuted} />
            <Text style={styles.emptyTitle}>No PalPoints received yet</Text>
            <Text style={styles.emptySubtitle}>
              Share your business code. When a tourist sends PalPoints, it appears here instantly.
            </Text>
          </View>
        ) : (
          history.map((item) => {
            const tourist = (item as any).user?.name || `Tourist`;
            const offer = item.offerTitle || item.offer?.title || 'Points received';
            return (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyCardHeader}>
                  <Text style={styles.historyOfferName} numberOfLines={1}>{offer}</Text>
                  <Text style={styles.pointsBadge}>+{item.pointsSpent} pts</Text>
                </View>
                <View style={styles.historyCardDetails}>
                  <Text style={styles.historyDetail}>From {tourist}</Text>
                  <Text style={styles.historyDetail}>
                    {new Date(item.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  {item.receiptNumber ? (
                    <Text style={styles.historyDetail}>Receipt: {item.receiptNumber}</Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VendorUI.colors.bg },
  header: {
    paddingHorizontal: VendorUI.space.screen,
    paddingVertical: VendorUI.space.md,
    borderBottomWidth: 1,
    borderBottomColor: VendorUI.colors.border,
  },
  headerCenter: { alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: VendorUI.colors.text },
  subtitle: { fontSize: 12, color: VendorUI.colors.textMuted, marginTop: 2 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: VendorUI.space.screen,
    marginVertical: VendorUI.space.md,
    padding: VendorUI.space.lg,
    borderRadius: VendorUI.radius.lg,
    backgroundColor: VendorUI.colors.surface,
    borderWidth: 1,
    borderColor: VendorUI.colors.border,
  },
  summaryLabel: { fontSize: 12, color: VendorUI.colors.textSecondary },
  summaryValue: { fontSize: 24, fontWeight: '800', color: VendorUI.colors.primaryDark, marginTop: 2 },
  summaryHint: { fontSize: 11, color: VendorUI.colors.textMuted, marginTop: 6, lineHeight: 15 },
  historyScroll: { flex: 1 },
  historyContent: { paddingHorizontal: VendorUI.space.screen, gap: 10 },
  historyTitle: { ...VendorUI.typography.section, color: VendorUI.colors.text, marginTop: VendorUI.space.xs },
  historyLoading: { paddingTop: 60, alignItems: 'center' },
  emptyState: { paddingTop: 60, alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: VendorUI.colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: VendorUI.colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  historyCard: {
    backgroundColor: VendorUI.colors.surface,
    borderRadius: VendorUI.radius.md,
    padding: VendorUI.space.md,
    borderWidth: 1,
    borderColor: VendorUI.colors.border,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  historyOfferName: { flex: 1, fontSize: 14, fontWeight: '700', color: VendorUI.colors.text },
  pointsBadge: { fontSize: 14, fontWeight: '800', color: VendorUI.colors.primaryDark },
  historyCardDetails: { marginTop: 8, gap: 2 },
  historyDetail: { fontSize: 12, color: VendorUI.colors.textSecondary },
});
