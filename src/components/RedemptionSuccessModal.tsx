import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '../utils/Icons';
import { colors, spacing, borderRadius, shadows } from '../config/theme';
import { VendorOfferRedemption, VendorOffer, VendorBusiness } from '../types';

interface RedemptionSuccessModalProps {
  visible: boolean;
  redemption: VendorOfferRedemption | null;
  offer: VendorOffer | null;
  vendor: VendorBusiness | null;
  onClose: () => void;
}

export default function RedemptionSuccessModal({
  visible,
  redemption,
  offer,
  vendor,
  onClose,
}: RedemptionSuccessModalProps) {
  if (!redemption || !offer || !vendor) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          </View>

          <Text style={styles.title}>Redemption Successful!</Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Vendor</Text>
              <Text style={styles.detailValue}>{vendor.businessName}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Offer</Text>
              <Text style={styles.detailValue}>{offer.offerTitle}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Points Spent</Text>
              <Text style={[styles.detailValue, styles.pointsSpent]}>
                -{redemption.pointsSpent} pts
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Discount</Text>
              <Text style={[styles.detailValue, styles.discountValue]}>
                {offer.discountType === 'flat'
                  ? `₹${offer.discountValue} off`
                  : `${offer.discountValue}% off`}
              </Text>
            </View>
          </View>

          <View style={styles.statusSection}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>Pending Vendor Verification</Text>
            </View>
          </View>

          <View style={styles.verificationSection}>
            <Text style={styles.verificationLabel}>Redemption Code</Text>
            <Text style={styles.verificationCode}>{redemption.verificationCode}</Text>
            <Text style={styles.verificationHint}>
              Show this code to {vendor.businessName} at their counter. The vendor will verify your redemption.
            </Text>
          </View>

          {offer.couponCode && (
            <View style={styles.couponSection}>
              <Text style={styles.couponLabel}>Coupon Code</Text>
              <Text style={styles.couponCode}>{offer.couponCode}</Text>
            </View>
          )}

          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.disclaimerText}>
              Pal Points are reward points and not cash. Discount is provided by the vendor business.
            </Text>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...shadows.lg,
  },
  successIcon: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  detailCard: {
    width: '100%',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border + '60',
  },
  pointsSpent: {
    color: colors.danger,
  },
  discountValue: {
    color: colors.success,
  },
  statusSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    backgroundColor: colors.warning + '30',
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warning + '60',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  couponSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  couponLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  couponCode: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 2,
  },
  verificationSection: {
    width: '100%',
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  verificationLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  verificationCode: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primaryLight,
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  verificationHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  disclaimerText: {
    fontSize: 11,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },
  closeButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.xxl,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
