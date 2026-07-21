import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, StatusBar, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../config/theme';
import { MaterialIcons } from '../utils/Icons';
import { useDataContext } from '../context/DataContext';
import { DEV_FLAGS } from '../config/devFlags';
import { vendorsApi, apiClient } from '../services/api';
import { VendorOffer } from '../types';
import { useVendorScreenInsets, VendorUI } from '../design/vendorLayout';

interface CreateOfferScreenProps {
  onBack: () => void;
  offerId?: string;
}

export default function CreateOfferScreen({ onBack, offerId }: CreateOfferScreenProps) {
  const { currentVendor, createVendorOffer, vendorOffers, refreshVendorData } = useDataContext();
  const screenInsets = useVendorScreenInsets({ withTabBar: false });
  const existing = offerId ? vendorOffers.find(o => o.id === offerId) : undefined;
  const isEditing = !!existing;

  const [title, setTitle] = useState(existing?.offerTitle || '');
  const [description, setDescription] = useState(existing?.offerDescription || '');
  const normalizeType = (raw?: string): 'flat' | 'percentage' | 'freebie' => {
    const v = String(raw || '').trim().toLowerCase();
    if (v === 'percentage' || v === 'percent') return 'percentage';
    if (v === 'flat' || v === 'fixed') return 'flat';
    if (v === 'freebie' || v === 'other' || v === 'bogo') return 'freebie';
    return 'flat';
  };

  const [discountType, setDiscountType] = useState<'flat' | 'percentage' | 'freebie'>(
    normalizeType(existing?.discountType),
  );
  const [discountValue, setDiscountValue] = useState(
    existing && normalizeType(existing.discountType) !== 'freebie' ? String(existing.discountValue ?? '') : '',
  );
  const [pointsRequired, setPointsRequired] = useState(existing ? String(existing.pointsRequired) : '');
  const [minBill, setMinBill] = useState(existing?.minBillAmount != null ? String(existing.minBillAmount) : '');
  const [dailyLimit, setDailyLimit] = useState(existing?.dailyLimit != null ? String(existing.dailyLimit) : '');
  const [couponCode, setCouponCode] = useState(existing?.couponCode || '');
  const [validTill, setValidTill] = useState(
    existing?.validTill ? String(existing.validTill).slice(0, 10) : '',
  );
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [scheduleLater, setScheduleLater] = useState(!!existing?.startDate);
  const [startDate, setStartDate] = useState(
    existing?.startDate ? String(existing.startDate).slice(0, 10) : '',
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Edit mode: load offers once if this offer isn't in memory yet.
    if (!offerId || existing) return;
    let cancelled = false;
    (async () => {
      try {
        const offersRes = await vendorsApi.listMyOffers();
        if (cancelled) return;
        const list = (offersRes as any)?.data || offersRes || [];
        const found = list.find((o: any) => o.id === offerId);
        if (!found) return;
        // Pull full vendor offers into context via a light refresh of offers only
        await refreshVendorData();
      } catch {
        /* ignore — form stays blank until user retries */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot when opening edit
  }, [offerId]);

  useEffect(() => {
    if (!existing) return;
    const dtype = normalizeType(existing.discountType);
    setTitle(existing.offerTitle || '');
    setDescription(existing.offerDescription || '');
    setDiscountType(dtype);
    setDiscountValue(dtype !== 'freebie' ? String(existing.discountValue ?? '') : '');
    setPointsRequired(String(existing.pointsRequired || ''));
    setMinBill(existing.minBillAmount != null ? String(existing.minBillAmount) : '');
    setDailyLimit(existing.dailyLimit != null ? String(existing.dailyLimit) : '');
    setCouponCode(existing.couponCode || '');
    setValidTill(existing.validTill ? String(existing.validTill).slice(0, 10) : '');
    setIsActive(existing.isActive);
    setScheduleLater(!!existing.startDate);
    setStartDate(existing.startDate ? String(existing.startDate).slice(0, 10) : '');
  }, [existing?.id]);

  const handleSave = async () => {
    if (!currentVendor || currentVendor.verificationStatus !== 'approved') {
      Alert.alert('Access Denied', 'Only approved vendors can manage offers.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) { Alert.alert('Validation', 'Offer title is required.'); return; }
    if (trimmedTitle.length < 3) { Alert.alert('Validation', 'Offer title must be at least 3 characters.'); return; }
    if (trimmedTitle.length > 100) { Alert.alert('Validation', 'Offer title must be under 100 characters.'); return; }

    const pts = parseInt(pointsRequired, 10);
    if (!pts || pts <= 0) { Alert.alert('Validation', 'Points required must be greater than 0.'); return; }

    const discountVal = parseInt(discountValue, 10);
    if (discountType !== 'freebie') {
      if (!discountValue.trim()) { Alert.alert('Validation', 'Discount value is required.'); return; }
      if (!discountVal || discountVal <= 0) { Alert.alert('Validation', 'Discount value must be greater than 0.'); return; }
      if (discountType === 'percentage' && discountVal > 100) { Alert.alert('Validation', 'Percentage discount cannot exceed 100%.'); return; }
    }

    const billAmount = parseInt(minBill, 10);
    if (minBill.trim() && (!billAmount || billAmount < 0)) { Alert.alert('Validation', 'Invalid minimum bill amount.'); return; }

    const dailyCap = parseInt(dailyLimit, 10);
    if (dailyLimit.trim() && (!dailyCap || dailyCap < 1)) {
      Alert.alert('Validation', 'Daily limit must be at least 1 if set.');
      return;
    }

    const code = couponCode.trim().toUpperCase();

    let finalStartDate: string | undefined;
    if (scheduleLater && startDate.trim()) {
      const parsed = new Date(startDate.trim());
      if (isNaN(parsed.getTime())) {
        Alert.alert('Validation', 'Please enter a valid start date (YYYY-MM-DD).');
        return;
      }
      finalStartDate = parsed.toISOString();
    }

    let finalValidTill: string | undefined;
    if (validTill.trim()) {
      const parsed = new Date(validTill.trim());
      if (isNaN(parsed.getTime())) {
        Alert.alert('Validation', 'Please enter a valid end date (YYYY-MM-DD).');
        return;
      }
      finalValidTill = parsed.toISOString();
    }

    const payload: {
      title: string;
      description?: string;
      discountType: string;
      discountValue: number;
      pointsRequired: number;
      minBillAmount?: number;
      dailyLimit?: number;
      couponCode?: string;
      validTill?: string;
      startDate?: string;
      isActive: boolean;
    } = {
      title: trimmedTitle,
      description: description.trim() || undefined,
      discountType: normalizeType(discountType),
      discountValue: discountType === 'freebie' ? 0 : discountVal,
      pointsRequired: pts,
      minBillAmount: minBill.trim() ? billAmount : undefined,
      dailyLimit: dailyLimit.trim() ? dailyCap : undefined,
      couponCode: code || undefined,
      validTill: finalValidTill,
      isActive,
    };
    if (scheduleLater && finalStartDate) {
      payload.startDate = finalStartDate;
    }

    setSaving(true);
    try {
      if (DEV_FLAGS.USE_SERVER_API) {
        const ok = await apiClient.ensureAuth();
        if (!ok || !apiClient.getToken()) {
          Alert.alert(
            'Session Expired',
            'Please log out and sign in again as a vendor to create offers.',
          );
          return;
        }

        if (isEditing && offerId) {
          const updated = await vendorsApi.updateOffer(offerId, payload);
          createVendorOffer({
            id: offerId,
            vendorId: currentVendor.id,
            offerTitle: updated?.title || trimmedTitle,
            offerDescription: updated?.description || description.trim(),
            discountType: normalizeType(updated?.discountType || discountType),
            discountValue: updated?.discountValue ?? payload.discountValue,
            pointsRequired: updated?.pointsRequired ?? pts,
            minBillAmount: updated?.minBillAmount ?? payload.minBillAmount,
            dailyLimit: updated?.dailyLimit ?? payload.dailyLimit,
            couponCode: updated?.couponCode ?? payload.couponCode,
            startDate: updated?.startDate ?? finalStartDate,
            validTill: updated?.validTill ?? finalValidTill,
            isActive: updated?.isActive ?? isActive,
            createdAt: existing?.createdAt || new Date().toISOString(),
            currentRedemptions: existing?.currentRedemptions ?? 0,
          });
        } else {
          const created = await vendorsApi.createOffer(payload);
          if (created?.id) {
            const mapped: VendorOffer = {
              id: created.id,
              vendorId: created.vendorId || currentVendor.id,
              offerTitle: created.title || trimmedTitle,
              offerDescription: created.description || description.trim(),
              discountType: normalizeType(created.discountType || discountType),
              discountValue: created.discountValue ?? payload.discountValue,
              pointsRequired: created.pointsRequired ?? pts,
              minBillAmount: created.minBillAmount ?? payload.minBillAmount,
              dailyLimit: created.dailyLimit ?? payload.dailyLimit,
              couponCode: created.couponCode ?? payload.couponCode,
              startDate: created.startDate ?? finalStartDate,
              validTill: created.validTill ?? finalValidTill,
              isActive: created.isActive ?? true,
              createdAt: created.createdAt || new Date().toISOString(),
              currentRedemptions: created.currentRedemptions ?? 0,
            };
            createVendorOffer(mapped);
            if (!isActive) {
              try {
                await vendorsApi.pauseOffer(created.id);
                createVendorOffer({ ...mapped, isActive: false });
              } catch {
                /* pause optional after create */
              }
            }
          } else {
            throw new Error('Offer was not created. Please try again.');
          }
        }
      } else {
        const local: VendorOffer = {
          id: offerId || `offer_${currentVendor.id}_${Date.now()}`,
          vendorId: currentVendor.id,
          offerTitle: trimmedTitle,
          offerDescription: description.trim(),
          discountType,
          discountValue: payload.discountValue,
          pointsRequired: pts,
          minBillAmount: payload.minBillAmount,
          dailyLimit: payload.dailyLimit,
          couponCode: payload.couponCode,
          startDate: finalStartDate,
          validTill: finalValidTill,
          isActive,
          createdAt: existing?.createdAt || new Date().toISOString(),
        };
        createVendorOffer(local);
      }

      Alert.alert(isEditing ? 'Offer Updated' : 'Offer Created', isEditing ? 'Changes saved.' : 'Offer created successfully.', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (err: any) {
      const msg = err?.message || '';
      const fieldErrors = Array.isArray(err?.data?.errors)
        ? err.data.errors.map((e: any) => `${e.field || 'field'}: ${e.message}`).join('\n')
        : '';
      if (err?.status === 429 || /too many requests/i.test(msg)) {
        Alert.alert(
          'Please wait',
          'The server is rate-limiting requests. Wait about a minute, then try saving the offer again.',
        );
      } else if (err?.status === 401 || /authentication required|valid token|expired token/i.test(msg)) {
        Alert.alert(
          'Session Expired',
          'Your login session expired. Please log out and sign in again with your vendor account.',
        );
      } else if (err?.status === 400 || /validation failed/i.test(msg)) {
        Alert.alert('Validation failed', fieldErrors || msg || 'Please check offer fields and try again.');
      } else {
        Alert.alert('Error', fieldErrors || msg || `Failed to ${isEditing ? 'update' : 'create'} offer. Please try again.`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? 'Edit Offer' : 'Create Offer'}</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={{
            paddingHorizontal: VendorUI.space.screen,
            paddingBottom: screenInsets.bottom + VendorUI.space.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {currentVendor && (
            <View style={styles.vendorInfo}>
              <Text style={styles.vendorLabel}>{isEditing ? 'Editing offer for' : 'Creating offer for'}</Text>
              <Text style={styles.vendorName}>{currentVendor.businessName}</Text>
            </View>
          )}

          <TextInput style={styles.input} placeholder="Offer Title *" placeholderTextColor={colors.textMuted}
            value={title} onChangeText={setTitle} />
          <TextInput style={[styles.input, styles.textArea]} placeholder="Offer Description" placeholderTextColor={colors.textMuted}
            value={description} onChangeText={setDescription} multiline />

          <Text style={styles.label}>Discount Type *</Text>
          <View style={styles.typeRow}>
            {(['flat', 'percentage', 'freebie'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeChip, discountType === type && styles.typeChipActive]}
                onPress={() => setDiscountType(type)}
              >
                <Text style={[styles.typeText, discountType === type && styles.typeTextActive]}>
                  {type === 'flat' ? '₹ Flat' : type === 'percentage' ? '% Off' : 'Freebie'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {discountType !== 'freebie' && (
            <TextInput style={styles.input} placeholder="Discount Value * (e.g. 50 or 10)" placeholderTextColor={colors.textMuted}
              value={discountValue} onChangeText={setDiscountValue} keyboardType="numeric" />
          )}

          <TextInput style={styles.input} placeholder="Points Required *" placeholderTextColor={colors.textMuted}
            value={pointsRequired} onChangeText={setPointsRequired} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="Min Bill Amount (₹)" placeholderTextColor={colors.textMuted}
            value={minBill} onChangeText={setMinBill} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="Daily redemption limit (optional)" placeholderTextColor={colors.textMuted}
            value={dailyLimit} onChangeText={setDailyLimit} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="Coupon Code (e.g. SAVE50)" placeholderTextColor={colors.textMuted}
            value={couponCode} onChangeText={setCouponCode} autoCapitalize="characters" />
          <TextInput style={styles.input} placeholder="Valid Till (YYYY-MM-DD)" placeholderTextColor={colors.textMuted}
            value={validTill} onChangeText={setValidTill} />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Schedule for later</Text>
            <Switch value={scheduleLater} onValueChange={setScheduleLater} trackColor={{ false: colors.surfaceLight, true: colors.warning }} />
          </View>
          {scheduleLater && (
            <TextInput style={styles.input} placeholder="Start Date (YYYY-MM-DD) *" placeholderTextColor={colors.textMuted}
              value={startDate} onChangeText={setStartDate} />
          )}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Publish / Active</Text>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: colors.surfaceLight, true: colors.primary }} />
          </View>

          <TouchableOpacity
            style={[styles.createButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={styles.createButtonText}>
              {saving ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Offer')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: VendorUI.space.screen,
    paddingVertical: VendorUI.space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerBtn: {
    width: VendorUI.headerBtnSize,
    height: VendorUI.headerBtnSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  vendorInfo: {
    backgroundColor: colors.surface,
    borderRadius: VendorUI.radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  vendorLabel: { fontSize: 12, color: colors.textMuted },
  vendorName: { fontSize: 16, fontWeight: '700', color: colors.primaryLight, marginTop: 2 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: VendorUI.radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: VendorUI.buttonHeight,
  },
  textArea: { height: 80, textAlignVertical: 'top', minHeight: 80 },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  typeChip: {
    flex: 1,
    minHeight: VendorUI.buttonHeight,
    backgroundColor: colors.surface,
    borderRadius: VendorUI.radius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { fontSize: 14, color: colors.textSecondary },
  typeTextActive: { color: colors.buttonText, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: VendorUI.radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: VendorUI.buttonHeight,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, paddingRight: 8 },
  createButton: {
    backgroundColor: colors.primary,
    minHeight: VendorUI.buttonHeight,
    borderRadius: VendorUI.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  createButtonText: { color: colors.buttonText, fontSize: 16, fontWeight: 'bold' },
});
