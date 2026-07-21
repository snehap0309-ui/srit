import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { TripPlan, TripPlanDay, TripPlanStop } from '../../services/api/trips';
import TripBudgetPanel, { feeLabel, getStopEntryFee } from './TripBudgetPanel';
import { computeTripBudget, formatInr } from '../../utils/tripBudget';
import {
  dayListKey,
  normalizeTripDays,
  stopListKey,
} from '../../utils/normalizeTripPlan';

const C = {
  bg: '#FFF9F2',
  surface: '#FFFFFF',
  card: '#FBEFE2',
  ink: '#63300E',
  text: '#2C1810',
  textSub: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(200, 155, 60, 0.18)',
  green: '#D1FAE5',
  greenText: '#065F46',
  bluePill: '#E0F2FE',
  blueText: '#0369A1',
};

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const H_PAD = 16;

export type ItineraryTab = 'itinerary' | 'map' | 'budget';

type Props = {
  trip: TripPlan;
  currentDay: number;
  onDayChange: (index: number) => void;
  activeTab: ItineraryTab;
  onTabChange: (tab: ItineraryTab) => void;
  onBack: () => void;
  onEditTrip: () => void;
  onMenu: () => void;
  onReviewSave: () => void;
  onViewInsights: () => void;
  onAddDay: () => void;
  onAddPlace: () => void;
  onStopMenu: (stop: TripPlanStop) => void;
  onToggleBookmark: (stop: TripPlanStop) => void;
  renderMapTab?: () => React.ReactNode;
  renderBudgetTab?: () => React.ReactNode;
  reviewSaving?: boolean;
  /** Hide hero destination card (self-build / manual trips). */
  showDestinationCard?: boolean;
  /** Header title override (e.g. "My Journey"). */
  headerTitle?: string;
  /** Primary footer CTA label. */
  primaryActionLabel?: string;
  footerNote?: string;
  /** Show sticky footer on budget tab too. */
  showFooterOnBudget?: boolean;
};

function formatBudget(b?: string | null) {
  switch ((b || '').toUpperCase()) {
    case 'LOW': return 'Low Budget';
    case 'HIGH': return 'High Budget';
    case 'CUSTOM': return 'Luxury Budget';
    default: return 'Medium Budget';
  }
}

function formatTravelers(t?: string | null) {
  switch ((t || '').toUpperCase()) {
    case 'COUPLE': return '2 Travelers';
    case 'FAMILY': return 'Family';
    case 'FRIENDS': return 'Friends';
    default: return 'Solo';
  }
}

function travelerCountLabel(t?: string | null) {
  switch ((t || '').toUpperCase()) {
    case 'COUPLE': return '2 Travelers';
    case 'FAMILY': return '4 Travelers';
    case 'FRIENDS': return '3 Travelers';
    default: return '1 Traveler';
  }
}

function formatDisplayTime(t?: string | null) {
  if (!t) return '';
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ap}`;
}

function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start) return '';
  const a = formatDisplayTime(start);
  const b = end ? formatDisplayTime(end) : '';
  return b ? `${a} — ${b}` : a;
}

function formatDuration(minutes?: number | null) {
  if (!minutes) return '';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

function driveMins(km?: number | null) {
  if (!km) return '';
  return `${Math.max(5, Math.round(km * 2.5))} mins`;
}

function formatCreated(dateStr?: string) {
  if (!dateStr) return 'Recently';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return 'Recently';
  }
}

function dateRangeLabel(trip: TripPlan) {
  if (trip.startDate && trip.endDate) {
    const s = new Date(trip.startDate);
    const e = new Date(trip.endDate);
    return `${s.getDate()} – ${e.getDate()} ${e.toLocaleDateString('en-IN', { month: 'short' })}`;
  }
  return `${trip.days} Days`;
}

export default function TripItineraryView({
  trip,
  currentDay,
  onDayChange,
  activeTab,
  onTabChange,
  onBack,
  onEditTrip,
  onMenu,
  onReviewSave,
  onViewInsights,
  onAddDay,
  onAddPlace,
  onStopMenu,
  onToggleBookmark,
  renderMapTab,
  renderBudgetTab,
  reviewSaving = false,
  showDestinationCard = true,
  headerTitle = 'My Itinerary',
  primaryActionLabel = 'Review & Save Trip',
  footerNote = 'You can review, edit and save your trip',
  showFooterOnBudget = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const [summaryOpen, setSummaryOpen] = useState(true);

  const days = useMemo(() => normalizeTripDays(trip.tripDays), [trip.tripDays]);
  const currentDayData = days[currentDay];
  const stops = currentDayData?.stops || [];

  const totalPlaces = useMemo(
    () => days.reduce((n, d) => n + (d.stops?.length || 0), 0),
    [days],
  );

  const coverImage = useMemo(() => {
    for (const day of days) {
      for (const stop of day.stops || []) {
        const img = stop.place?.thumbnail || stop.place?.images?.[0];
        if (img) return img;
      }
    }
    return 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80';
  }, [days]);

  const dayStats = useMemo(() => {
    const placeCount = stops.length;
    const distance = stops.reduce((s, st) => s + (st.distanceFromPrev || 0), 0);
    const travelMins = stops.reduce((s, st) => s + (st.duration || 0), 0);
    const cost = stops.reduce((s, st) => {
      const fee = getStopEntryFee(st);
      return s + (fee && fee > 0 ? fee : 0);
    }, 0);
    return { placeCount, distance, travelMins, cost };
  }, [stops]);

  const budgetSummary = useMemo(
    () => computeTripBudget({ ...trip, tripDays: days }),
    [trip, days],
  );

  const showFooter = activeTab === 'itinerary' || (showFooterOnBudget && activeTab === 'budget');

  const tabs: { key: ItineraryTab; label: string; icon: string }[] = [
    { key: 'itinerary', label: 'Itinerary', icon: 'map-outline' },
    { key: 'map', label: 'Map View', icon: 'location-outline' },
    { key: 'budget', label: 'Budget', icon: 'wallet-outline' },
  ];

  const hasScheduledStops = days.some(d => d.stops?.some(s => s.startTime));
  const showAiBanner =
    trip.generationSource === 'AI_PROMPT' ||
    trip.generationSource === 'HYBRID' ||
    !!trip.generatedAt ||
    !!trip.totalDistance ||
    hasScheduledStops;

  const renderDriveRow = (stop: TripPlanStop) => {
    if (!stop.distanceFromPrev || stop.distanceFromPrev <= 0) return null;
    return (
      <View style={styles.driveRow}>
        <Icon name="car-outline" size={14} color={C.textMuted} />
        <Text style={styles.driveText}>Drive {stop.distanceFromPrev.toFixed(1)} km</Text>
        <Text style={styles.driveTime}>{driveMins(stop.distanceFromPrev)}</Text>
      </View>
    );
  };

  const renderLunchBreak = (afterIndex: number) => {
    if (stops.length < 4 || afterIndex !== 1) return null;
    return (
      <View style={styles.lunchRow}>
        <MaterialCommunityIcons name="silverware-fork-knife" size={16} color={C.greenText} />
        <View style={{ flex: 1 }}>
          <Text style={styles.lunchTitle}>Lunch Break</Text>
          <Text style={styles.lunchTime}>02:00 PM — 03:00 PM</Text>
        </View>
        <View style={styles.durationPill}>
          <Text style={styles.durationPillText}>1h</Text>
        </View>
      </View>
    );
  };

  const renderTimeline = () => (
    <View style={styles.timeline}>
      {stops.length === 0 ? (
        <View style={styles.emptyDay}>
          <Text style={styles.emptyDayEmoji}>📅</Text>
          <Text style={styles.emptyDayTitle}>Day {currentDay + 1} is empty</Text>
          <Text style={styles.emptyDaySub}>Add places to build your itinerary for this day.</Text>
          <TouchableOpacity style={styles.emptyDayBtn} onPress={onAddPlace}>
            <Text style={styles.emptyDayBtnText}>+ Add Places</Text>
          </TouchableOpacity>
        </View>
      ) : (
        stops.map((stop, i) => {
          const img = stop.place?.thumbnail || stop.place?.images?.[0];
          return (
            <React.Fragment key={stopListKey(stop, i)}>
              {i > 0 ? renderDriveRow(stop) : null}
              {renderLunchBreak(i - 1)}
              <View style={styles.timelineItem}>
                <View style={styles.timelineRail}>
                  <View style={styles.timelineDot}>
                    <Text style={styles.timelineDotText}>{i + 1}</Text>
                  </View>
                  {i < stops.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.stopCard}>
                  {img ? (
                    <Image source={{ uri: img }} style={styles.stopThumb} />
                  ) : (
                    <View style={[styles.stopThumb, styles.stopThumbFallback]}>
                      <Icon name="image-outline" size={18} color={C.textMuted} />
                    </View>
                  )}
                  <View style={styles.stopBody}>
                    <View style={styles.stopTopRow}>
                      <Text style={styles.stopName} numberOfLines={1}>{stop.place?.name || 'Place'}</Text>
                      <View style={styles.stopActions}>
                        <TouchableOpacity hitSlop={8} onPress={() => onStopMenu(stop)}>
                          <Icon name="ellipsis-vertical" size={16} color={C.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity hitSlop={8} onPress={() => onToggleBookmark(stop)}>
                          <Icon name="bookmark-outline" size={16} color={C.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {!!stop.startTime && (
                      <Text style={styles.stopTime}>{formatTimeRange(stop.startTime, stop.endTime)}</Text>
                    )}
                    {!!stop.duration && (
                      <View style={styles.durationPill}>
                        <Text style={styles.durationPillText}>{formatDuration(stop.duration)}</Text>
                      </View>
                    )}
                    <View style={styles.stopLocRow}>
                      <Icon name="location-outline" size={11} color={C.textSub} />
                      <Text style={styles.stopLoc} numberOfLines={1}>
                        {[stop.place?.city, stop.place?.state].filter(Boolean).join(', ') || 'India'}
                      </Text>
                    </View>
                    {(() => {
                      const fee = getStopEntryFee(stop);
                      if (fee === null) return null;
                      return (
                        <Text style={[styles.stopPrice, fee <= 0 && styles.stopPriceFree]}>
                          {feeLabel(fee)}
                        </Text>
                      );
                    })()}
                  </View>
                </View>
              </View>
            </React.Fragment>
          );
        })
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + (showFooter ? 160 : 24) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.headerBtn} onPress={onBack}>
            <Icon name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="map-outline" size={18} color={C.ink} />
              <Text style={styles.headerTitle}>{headerTitle}</Text>
            </View>
            <Text style={styles.headerSub} numberOfLines={1}>
              {trip.title || trip.destination} • {trip.days} Days • {travelerCountLabel(trip.travelers)}
            </Text>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={onEditTrip}>
            <Icon name="create-outline" size={14} color={C.text} />
            <Text style={styles.editBtnText}>Edit Trip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={onMenu}>
            <Icon name="ellipsis-vertical" size={20} color={C.text} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {tabs.map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => onTabChange(tab.key)}>
                <Icon name={tab.icon as any} size={16} color={active ? C.ink : C.textMuted} />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
                {active && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeTab === 'itinerary' && (
          <>
            {showDestinationCard ? (
              <View style={styles.destCard}>
                <ImageBackground source={{ uri: coverImage }} style={styles.destImage} imageStyle={styles.destImageInner}>
                  <View style={styles.destBadge}>
                    <Text style={styles.destBadgeText}>{trip.days} Days Trip</Text>
                  </View>
                </ImageBackground>
                <View style={styles.destBody}>
                  <Text style={styles.destTitle}>{trip.destination || trip.title}</Text>
                  <Text style={styles.destCreated}>Created on {formatCreated(trip.createdAt)}</Text>
                  <View style={styles.destChips}>
                    <View style={styles.destChip}>
                      <Icon name="calendar-outline" size={12} color={C.textSub} />
                      <Text style={styles.destChipText}>{dateRangeLabel(trip)}</Text>
                    </View>
                    <View style={styles.destChip}>
                      <Icon name="people-outline" size={12} color={C.textSub} />
                      <Text style={styles.destChipText}>{formatTravelers(trip.travelers)}</Text>
                    </View>
                    <View style={styles.destChip}>
                      <Icon name="pricetag-outline" size={12} color={C.textSub} />
                      <Text style={styles.destChipText}>{formatBudget(trip.budget)}</Text>
                    </View>
                  </View>
                </View>
                {showAiBanner && (
                  <TouchableOpacity style={styles.aiBanner} activeOpacity={0.88} onPress={onViewInsights}>
                    <MaterialCommunityIcons name="creation" size={18} color={C.greenText} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.aiBannerTitle}>AI Optimized Route</Text>
                      <Text style={styles.aiBannerSub}>Route optimized for less travel time and more experiences</Text>
                    </View>
                    <Text style={styles.aiBannerLink}>View Insights ›</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {/* Trip overview */}
            <Text style={styles.sectionLabel}>Trip Overview</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Icon name="location" size={16} color="#2563EB" />
                </View>
                <Text style={styles.statValue}>{totalPlaces}</Text>
                <Text style={styles.statLabel}>Places</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: '#D1FAE5' }]}>
                  <MaterialCommunityIcons name="road-variant" size={16} color="#059669" />
                </View>
                <Text style={styles.statValue}>{trip.totalDistance ? `${trip.totalDistance.toFixed(1)} km` : '—'}</Text>
                <Text style={styles.statLabel}>Total Distance</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: '#FFEDD5' }]}>
                  <Icon name="time-outline" size={16} color="#EA580C" />
                </View>
                <Text style={styles.statValue}>
                  {trip.totalTravelTime ? `~ ${formatDuration(trip.totalTravelTime)}` : '—'}
                </Text>
                <Text style={styles.statLabel}>Total Travel Time</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: '#EDE9FE' }]}>
                  <Icon name="cash-outline" size={16} color="#7C3AED" />
                </View>
                <Text style={styles.statValue}>
                  {budgetSummary.grandTotal > 0 ? formatInr(budgetSummary.grandTotal) : '—'}
                </Text>
                <Text style={styles.statLabel}>Est. Total Budget</Text>
              </View>
            </View>

            {/* Day controls */}
            <View style={styles.dayControls}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayPills}>
                {days.map((day, i) => (
                  <TouchableOpacity
                    key={dayListKey(day, i)}
                    style={[styles.dayPill, currentDay === i && styles.dayPillActive]}
                    onPress={() => onDayChange(i)}
                  >
                    <Text style={[styles.dayPillText, currentDay === i && styles.dayPillTextActive]}>
                      Day {day.dayNumber}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.dayMetaRow}>
                <View style={styles.startTimeChip}>
                  <Icon name="sunny-outline" size={14} color={C.textSub} />
                  <Text style={styles.startTimeText}>Start Time 09:00 AM</Text>
                </View>
                <TouchableOpacity style={styles.addDayBtn} onPress={onAddDay}>
                  <Icon name="add" size={14} color={C.ink} />
                  <Text style={styles.addDayText}>Add Day</Text>
                </TouchableOpacity>
              </View>
            </View>

            {renderTimeline()}
          </>
        )}

        {activeTab === 'map' && (renderMapTab?.() || (
          <View style={styles.placeholderTab}>
            <Icon name="map-outline" size={40} color={C.textMuted} />
            <Text style={styles.placeholderText}>Map view for day {currentDay + 1}</Text>
          </View>
        ))}

        {activeTab === 'budget' && (renderBudgetTab?.() || <TripBudgetPanel trip={trip} />)}
      </ScrollView>

      {/* Sticky footer */}
      {showFooter && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={styles.summaryBar} onPress={() => setSummaryOpen(v => !v)} activeOpacity={0.9}>
            <Icon name="briefcase-outline" size={16} color={C.ink} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>Day {currentDayData?.dayNumber || currentDay + 1} Summary</Text>
              <Text style={styles.summaryMeta}>
                {dayStats.placeCount} Places • {dayStats.distance.toFixed(1)} km • ~ {formatDuration(dayStats.travelMins) || '—'}
              </Text>
            </View>
            <Text style={styles.summaryCost}>
              Est. Cost: {dayStats.cost > 0 ? formatInr(dayStats.cost) : '—'}
            </Text>
            <Icon name={summaryOpen ? 'chevron-down' : 'chevron-up'} size={16} color={C.textSub} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, reviewSaving && { opacity: 0.75 }]}
            activeOpacity={0.88}
            onPress={onReviewSave}
            disabled={reviewSaving}
          >
            {reviewSaving ? (
              <ActivityIndicator size="small" color="#FFF9F2" />
            ) : (
              <Text style={styles.saveBtnText}>{primaryActionLabel}</Text>
            )}
          </TouchableOpacity>
          <View style={styles.footerNote}>
            <Icon name="shield-checkmark-outline" size={12} color={C.textMuted} />
            <Text style={styles.footerNoteText}>{footerNote}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    gap: 8,
    marginBottom: 12,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border,
  },
  headerCenter: { flex: 1, minWidth: 0 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 18, fontFamily: serif, fontWeight: '700', color: C.text },
  headerSub: { fontSize: 11, fontFamily: 'Inter-Medium', color: C.textSub, marginTop: 2 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  editBtnText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: C.text },
  menuBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },

  tabsRow: { paddingHorizontal: H_PAD, gap: 20, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  tabItem: { alignItems: 'center', paddingBottom: 10, minWidth: 72 },
  tabLabel: { fontSize: 12, fontFamily: 'Inter-Medium', color: C.textMuted, marginTop: 4 },
  tabLabelActive: { color: C.ink, fontFamily: 'Inter-Bold' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, backgroundColor: C.ink, borderRadius: 1 },

  destCard: {
    marginHorizontal: H_PAD,
    marginTop: 14,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  destImage: { height: 88, justifyContent: 'flex-start' },
  destImageInner: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  destBadge: {
    alignSelf: 'flex-start', margin: 8, backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  destBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#FFF' },
  destBody: { padding: 12 },
  destTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: C.text },
  destCreated: { fontSize: 11, fontFamily: 'Inter-Medium', color: C.textSub, marginTop: 2 },
  destChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  destChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  destChipText: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: C.textSub },
  aiBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.green, paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(6, 95, 70, 0.12)',
  },
  aiBannerTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: C.greenText },
  aiBannerSub: { fontSize: 10, fontFamily: 'Inter-Medium', color: C.greenText, marginTop: 1, opacity: 0.85 },
  aiBannerLink: { fontSize: 10, fontFamily: 'Inter-Bold', color: C.greenText },

  sectionLabel: {
    marginHorizontal: H_PAD, marginTop: 16, marginBottom: 8,
    fontSize: 14, fontFamily: 'Inter-Bold', color: C.text,
  },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: H_PAD, gap: 8,
  },
  statCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center',
  },
  statIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: 11, fontFamily: 'Inter-Bold', color: C.text, textAlign: 'center' },
  statLabel: { fontSize: 8, fontFamily: 'Inter-Medium', color: C.textSub, textAlign: 'center', marginTop: 2 },

  dayControls: { marginTop: 16, paddingHorizontal: H_PAD },
  dayPills: { gap: 8, paddingBottom: 10 },
  dayPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  dayPillActive: { backgroundColor: C.ink, borderColor: C.ink },
  dayPillText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: C.textSub },
  dayPillTextActive: { color: '#FFF9F2' },
  dayMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  startTimeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  startTimeText: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: C.textSub },
  addDayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addDayText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: C.ink },

  timeline: { paddingHorizontal: H_PAD, paddingTop: 8 },
  timelineItem: { flexDirection: 'row', marginBottom: 4 },
  timelineRail: { width: 32, alignItems: 'center' },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: C.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  timelineDotText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#FFF9F2' },
  timelineLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: C.border, marginVertical: 4 },
  stopCard: {
    flex: 1, flexDirection: 'row', gap: 10, marginLeft: 8, marginBottom: 12,
    backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 8,
  },
  stopThumb: { width: 56, height: 56, borderRadius: 10 },
  stopThumbFallback: { backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  stopBody: { flex: 1, minWidth: 0 },
  stopTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  stopName: { flex: 1, fontSize: 14, fontFamily: 'Inter-Bold', color: C.text, marginRight: 4 },
  stopActions: { flexDirection: 'row', gap: 6 },
  stopTime: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: C.textSub, marginTop: 2 },
  durationPill: {
    alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: C.bluePill, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  durationPillText: { fontSize: 10, fontFamily: 'Inter-Bold', color: C.blueText },
  stopLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  stopLoc: { flex: 1, fontSize: 10, fontFamily: 'Inter-Medium', color: C.textSub },
  stopPrice: { fontSize: 11, fontFamily: 'Inter-Bold', color: C.ink, marginTop: 4 },
  stopPriceFree: { color: C.greenText },

  driveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginLeft: 40, marginBottom: 8, marginTop: -2,
  },
  driveText: { flex: 1, fontSize: 11, fontFamily: 'Inter-Medium', color: C.textMuted },
  driveTime: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: C.textSub },

  lunchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginLeft: 40, marginBottom: 10, marginTop: 4,
    backgroundColor: C.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  lunchTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: C.greenText },
  lunchTime: { fontSize: 10, fontFamily: 'Inter-Medium', color: C.greenText, marginTop: 1 },

  emptyDay: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyDayEmoji: { fontSize: 40 },
  emptyDayTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: C.text },
  emptyDaySub: { fontSize: 12, fontFamily: 'Inter-Medium', color: C.textSub, textAlign: 'center' },
  emptyDayBtn: {
    marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: C.ink,
  },
  emptyDayBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#FFF9F2' },

  placeholderTab: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  placeholderText: { fontSize: 13, fontFamily: 'Inter-Medium', color: C.textSub },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border,
    paddingHorizontal: H_PAD, paddingTop: 10,
  },
  summaryBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10, borderWidth: 1, borderColor: C.border,
  },
  summaryTitle: { fontSize: 12, fontFamily: 'Inter-Bold', color: C.text },
  summaryMeta: { fontSize: 10, fontFamily: 'Inter-Medium', color: C.textSub, marginTop: 1 },
  summaryCost: { fontSize: 11, fontFamily: 'Inter-Bold', color: C.ink },
  saveBtn: {
    backgroundColor: C.ink, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFF9F2' },
  footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  footerNoteText: { fontSize: 10, fontFamily: 'Inter-Medium', color: C.textMuted },
});
