import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Modal, Alert, Platform, Linking, Share } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import Pal from '../design/DesignSystem';
import { GradientButton } from '../components/ui/GradientButton';
import { tripsApi, TripPlan, TripPlanDay, TripPlanStop, TripProgressResponse, TravelPace, BudgetTier, AvoidOption } from '../services/api/trips';
import { useToast } from '../context/ToastContext';
import TripItineraryView, { ItineraryTab } from '../components/trip/TripItineraryView';
import { normalizeTripDays, normalizeTripPlan, stopListKey } from '../utils/normalizeTripPlan';

const transportEmojis: Record<string, string> = {
  WALKING: '🚶', BIKE: '🚲', CAR: '🚗', TRAIN: '🚆', FLIGHT: '✈️',
};
const timeEmojis: Record<string, string> = {
  sunrise: '🌄', morning: '🌅', afternoon: '☀️', evening: '🌆', sunset: '🌅', night: '🌙',
};

export default function TripDetailScreen({
  tripId,
  warnings: initialWarnings,
  note: initialNote,
  onNavigate,
}: {
  tripId: string;
  warnings?: string[];
  note?: string;
  onNavigate?: (screen: string, params?: any) => void;
}) {
  const [trip, setTrip] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [currentDay, setCurrentDay] = useState(0);
  const [activeTab, setActiveTab] = useState<ItineraryTab>('itinerary');
  const [optimizing, setOptimizing] = useState(false);
  const [noteModal, setNoteModal] = useState<{ stop: TripPlanStop; text: string } | null>(null);
  const [progress, setProgress] = useState<TripProgressResponse | null>(null);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [refineModalVisible, setRefineModalVisible] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refinePace, setRefinePace] = useState<TravelPace>('BALANCED');
  const [refineBudget, setRefineBudget] = useState<BudgetTier>('MEDIUM');
  const [refineAvoid, setRefineAvoid] = useState<AvoidOption[]>([]);
  const [refineNotes, setRefineNotes] = useState('');
  const { showSuccess, showError } = useToast();

  const fetchTrip = useCallback(async () => {
    try {
      const tripData = await tripsApi.getById(tripId);
      setTrip(normalizeTripPlan(tripData));
    } catch (err: any) {
      console.warn('Failed to fetch trip:', err);
      showError(err?.message || 'Failed to load itinerary');
    } finally {
      setLoading(false);
    }
  }, [tripId, showError]);

  useEffect(() => {
    fetchTrip();
    if (trip?.status === 'ACTIVE') fetchProgress();
  }, [fetchTrip]);

  const fetchProgress = useCallback(async () => {
    try {
      const p = await tripsApi.getProgress(tripId);
      setProgress(p);
      if (p.currentDayIndex != null) setCurrentDay(p.currentDayIndex);
      if (p.currentStop?.id) setActiveStopId(p.currentStop.id);
    } catch (e) { console.warn('Caught empty exception', e); }
  }, [tripId]);

  const handleStartTrip = async () => {
    setStarting(true);
    try {
      const updatedTrip = await tripsApi.startTrip(tripId);
      setTrip(normalizeTripPlan(updatedTrip));
      setActiveStopId(updatedTrip.tripDays?.[0]?.stops?.[0]?.id || null);
      showSuccess('Trip started! Follow your itinerary.');
      fetchProgress();
    } catch (err: any) {
      showError(err?.message || 'Failed to start trip');
    }
    setStarting(false);
  };

  const handleCompleteTrip = () => {
    Alert.alert('Complete Trip', 'Mark this trip as completed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', style: 'destructive', onPress: async () => {
        try {
          const updatedTrip = await tripsApi.completeTrip(tripId);
          setTrip(normalizeTripPlan(updatedTrip));
          setProgress(null);
          setActiveStopId(null);
          showSuccess('Trip completed! Great journey!');
        } catch (err: any) {
          showError(err?.message || 'Failed to complete trip');
        }
      }},
    ]);
  };

  const handleVisitStop = async (stopId: string) => {
    try {
      await tripsApi.visitStop(stopId);
      fetchProgress();
      fetchTrip();
      showSuccess('Stop marked as visited!');
    } catch (err: any) {
      showError(err?.message || 'Failed to mark as visited');
    }
  };

  const handleSkipStop = async (stopId: string) => {
    try {
      await tripsApi.skipStop(stopId);
      fetchProgress();
      fetchTrip();
      showSuccess('Stop skipped');
    } catch (err: any) {
      showError(err?.message || 'Failed to skip stop');
    }
  };

  const handleShareTrip = async () => {
    try {
      const dayCount = trip?.tripDays?.length || 0;
      const stopCount = trip?.tripDays?.reduce((sum, d) => sum + d.stops.length, 0) || 0;
      await Share.share({
        message: `🗺️ Check out my trip "${trip?.title}" to ${trip?.destination} on PalSafar!\n📅 ${dayCount} days · 📍 ${stopCount} stops`,
      });
    } catch (e) { console.warn('Caught empty exception', e); }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const tripData = await tripsApi.optimizeRoute(tripId, { strategy: 'shortest' });
      setTrip(normalizeTripPlan(tripData));
      showSuccess('Itinerary optimized successfully!');
    } catch (err: any) {
      showError(err?.message || 'Failed to optimize itinerary');
    }
    setOptimizing(false);
  };

  const handleGenerateItinerary = async () => {
    setOptimizing(true);
    try {
      const tripData = await tripsApi.generateItinerary(tripId, { pace: 'moderate' });
      setTrip(normalizeTripPlan(tripData));
      showSuccess('Itinerary generated successfully!');
    } catch (err: any) {
      showError(err?.message || 'Failed to generate itinerary');
    }
    setOptimizing(false);
  };

  const openRefineModal = () => {
    if (!trip) return;
    setRefinePace(trip.pace || 'BALANCED');
    setRefineBudget((trip.budget as BudgetTier) || 'MEDIUM');
    setRefineAvoid(trip.avoid || []);
    setRefineNotes('');
    setRefineModalVisible(true);
  };

  const handleAiRefine = async () => {
    if (!trip) return;
    setRefining(true);
    try {
      const result = await tripsApi.aiGenerate({
        tripId: trip.id,
        destination: trip.destination || trip.title,
        days: trip.days,
        pace: refinePace,
        travelers: (trip.travelers as any) || 'SOLO',
        budget: refineBudget,
        interests: trip.interests || [],
        timePreference: trip.timePreference || undefined,
        avoid: refineAvoid,
        prompt: refineNotes || trip.aiPrompt || undefined,
      });
      setTrip(normalizeTripPlan(result.trip));
      setRefineModalVisible(false);
      showSuccess('Itinerary refined with AI!');
    } catch (err: any) {
      showError(err?.message || 'Failed to refine itinerary');
    }
    setRefining(false);
  };

  const handleRemoveStop = (stopId: string) => {
    Alert.alert('Remove Stop', 'Remove this stop from the itinerary?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await tripsApi.deleteStop(stopId);
          fetchTrip();
          showSuccess('Stop removed from itinerary');
        } catch (err: any) {
          showError(err?.message || 'Failed to remove stop');
        }
      }},
    ]);
  };

  const handleSaveNotes = async () => {
    if (!noteModal) return;
    try {
      await tripsApi.updateStop(noteModal.stop.id, { notes: noteModal.text });
      setNoteModal(null);
      fetchTrip();
      showSuccess('Notes saved successfully');
    } catch (err: any) {
      showError(err?.message || 'Failed to save notes');
    }
  };

  const handleReviewSave = async () => {
    try {
      const updated = await tripsApi.update(tripId, { status: 'UPCOMING' });
      setTrip(normalizeTripPlan(updated));
      showSuccess('Trip saved! Ready for your journey.');
    } catch (err: any) {
      showError(err?.message || 'Failed to save trip');
    }
  };

  const handleTripMenu = () => {
    Alert.alert('Trip options', undefined, [
      { text: 'Share trip', onPress: handleShareTrip },
      { text: 'Optimize route', onPress: handleOptimize },
      { text: 'AI refine', onPress: openRefineModal },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleStopMenu = (stop: TripPlanStop) => {
    Alert.alert(stop.place?.name || 'Stop', undefined, [
      ...(trip?.status === 'ACTIVE'
        ? [
            { text: 'Mark visited', onPress: () => handleVisitStop(stop.id) },
            { text: 'Skip stop', onPress: () => handleSkipStop(stop.id) },
          ]
        : [
            { text: 'Add notes', onPress: () => setNoteModal({ stop, text: stop.notes || '' }) },
            { text: 'Remove', style: 'destructive' as const, onPress: () => handleRemoveStop(stop.id) },
          ]),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Pal.colors.light.background, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <ActivityIndicator size="large" color={Pal.colors.light.primary} />
        <Text style={{ color: Pal.colors.light.textMuted, fontSize: 13 }}>Loading itinerary...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: Pal.colors.light.background, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 40 }}>
        <Text style={{ fontSize: 56 }}>🗺️</Text>
        <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 18, color: Pal.colors.light.text, textAlign: 'center' }}>
          Trip not found
        </Text>
        <Text style={{ color: Pal.colors.light.textMuted, fontSize: 13, textAlign: 'center' }}>
          This trip may have been deleted or you don't have access.
        </Text>
        <GradientButton title="Go Back" onPress={() => onNavigate?.('goBack')} size="sm" />
      </View>
    );
  }

  const days = normalizeTripDays(trip.tripDays);
  const currentDayData = days[currentDay];
  const stops = currentDayData?.stops || [];

  const mapTabContent = (
    <View style={{ marginHorizontal: Pal.spacing[5], marginBottom: Pal.spacing[5] }}>
      <View style={{ minHeight: 280, borderRadius: 16, backgroundColor: Pal.colors.light.surface, borderWidth: 1, borderColor: Pal.colors.light.border, padding: 16 }}>
        <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 15, color: Pal.colors.light.text, marginBottom: 12 }}>
          Route — Day {currentDay + 1}
        </Text>
        {stops.map((stop, i) => (
          <View key={stopListKey(stop, i)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: Pal.colors.light.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 10, fontFamily: Pal.typography.fontFamily.bold }}>{i + 1}</Text>
            </View>
            <Text style={{ marginLeft: 8, fontSize: 12, color: Pal.colors.light.text, flex: 1 }} numberOfLines={1}>{stop.place.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF9F2' }}>
      <TripItineraryView
        trip={trip}
        currentDay={currentDay}
        onDayChange={setCurrentDay}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onBack={() => onNavigate?.('goBack')}
        onEditTrip={() => onNavigate?.('TripBuilder')}
        onMenu={handleTripMenu}
        onReviewSave={handleReviewSave}
        onViewInsights={openRefineModal}
        onAddDay={() => Alert.alert('Add Day', 'Day management will be available in a future update.')}
        onAddPlace={() => onNavigate?.('Search')}
        onStopMenu={handleStopMenu}
        onToggleBookmark={() => showSuccess('Saved to bookmarks')}
        renderMapTab={() => mapTabContent}
      />

      <Modal visible={!!noteModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Pal.colors.light.surface, borderTopLeftRadius: Pal.borderRadius['2xl'], borderTopRightRadius: Pal.borderRadius['2xl'], padding: Pal.spacing[5], paddingBottom: Pal.spacing[10], gap: Pal.spacing[4] }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Pal.colors.light.border, alignSelf: 'center', marginBottom: 4 }} />
            <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 17, color: Pal.colors.light.text }}>
              Notes — {noteModal?.stop.place.name}
            </Text>
            <TextInput
              style={{
                minHeight: 120, borderWidth: 1, borderColor: Pal.colors.light.border, borderRadius: Pal.borderRadius.lg,
                padding: Pal.spacing[4], color: Pal.colors.light.text, fontSize: 14,
                textAlignVertical: 'top', backgroundColor: Pal.colors.light.surfaceSoft,
              }}
              value={noteModal?.text || ''}
              onChangeText={(text) => setNoteModal(prev => prev ? { ...prev, text } : null)}
              placeholder="Add notes, tips, or reminders..."
              placeholderTextColor={Pal.colors.light.textMuted}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setNoteModal(null)} style={{ flex: 1, height: 44, borderRadius: Pal.borderRadius.full, backgroundColor: Pal.colors.light.surface, borderWidth: 1, borderColor: Pal.colors.light.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: Pal.colors.light.text, fontFamily: Pal.typography.fontFamily.semibold, fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveNotes} style={{ flex: 1, height: 44, borderRadius: Pal.borderRadius.full, backgroundColor: Pal.colors.light.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontFamily: Pal.typography.fontFamily.semibold, fontSize: 13 }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={refineModalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Pal.colors.light.surface, borderTopLeftRadius: Pal.borderRadius['2xl'], borderTopRightRadius: Pal.borderRadius['2xl'], padding: Pal.spacing[5], paddingBottom: Pal.spacing[10], gap: Pal.spacing[4] }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Pal.colors.light.border, alignSelf: 'center', marginBottom: 4 }} />
            <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 17, color: Pal.colors.light.text }}>
              🪄 AI Refine Itinerary
            </Text>
            <Text style={{ fontSize: 12, color: Pal.colors.light.textMuted }}>
              Keeps your pinned stops and re-generates the rest around your updated preferences.
            </Text>

            <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 13, color: Pal.colors.light.text }}>Pace</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(['VERY_RELAXED', 'RELAXED', 'BALANCED', 'QUICK'] as TravelPace[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setRefinePace(p)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Pal.borderRadius.full,
                    backgroundColor: refinePace === p ? Pal.colors.light.primarySoft : Pal.colors.light.surfaceSoft,
                    borderWidth: 1, borderColor: refinePace === p ? Pal.colors.light.primary : Pal.colors.light.border,
                  }}
                >
                  <Text style={{ fontSize: 12, color: refinePace === p ? Pal.colors.light.primary : Pal.colors.light.text, fontFamily: Pal.typography.fontFamily.medium }}>
                    {p.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 13, color: Pal.colors.light.text }}>Budget</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(['LOW', 'MEDIUM', 'HIGH'] as BudgetTier[]).map((b) => (
                <TouchableOpacity
                  key={b}
                  onPress={() => setRefineBudget(b)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Pal.borderRadius.full,
                    backgroundColor: refineBudget === b ? Pal.colors.light.primarySoft : Pal.colors.light.surfaceSoft,
                    borderWidth: 1, borderColor: refineBudget === b ? Pal.colors.light.primary : Pal.colors.light.border,
                  }}
                >
                  <Text style={{ fontSize: 12, color: refineBudget === b ? Pal.colors.light.primary : Pal.colors.light.text, fontFamily: Pal.typography.fontFamily.medium }}>
                    {b}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 13, color: Pal.colors.light.text }}>Must avoid</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {([
                { key: 'CROWDED', label: 'Crowded' },
                { key: 'LONG_TRAVEL', label: 'Long travel' },
                { key: 'EXPENSIVE_ENTRY', label: 'Expensive entry' },
                { key: 'NON_FAMILY_FRIENDLY', label: 'Non-family friendly' },
              ] as { key: AvoidOption; label: string }[]).map((a) => {
                const selected = refineAvoid.includes(a.key);
                return (
                  <TouchableOpacity
                    key={a.key}
                    onPress={() => setRefineAvoid(prev => selected ? prev.filter(x => x !== a.key) : [...prev, a.key])}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: Pal.borderRadius.full,
                      backgroundColor: selected ? '#FEE2E2' : Pal.colors.light.surfaceSoft,
                      borderWidth: 1, borderColor: selected ? '#EF4444' : Pal.colors.light.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: selected ? '#EF4444' : Pal.colors.light.text, fontFamily: Pal.typography.fontFamily.medium }}>
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 13, color: Pal.colors.light.text }}>Anything else? (optional)</Text>
            <TextInput
              style={{
                minHeight: 60, borderWidth: 1, borderColor: Pal.colors.light.border, borderRadius: Pal.borderRadius.lg,
                padding: Pal.spacing[3], color: Pal.colors.light.text, fontSize: 13,
                textAlignVertical: 'top', backgroundColor: Pal.colors.light.surfaceSoft,
              }}
              value={refineNotes}
              onChangeText={setRefineNotes}
              placeholder="e.g. Prefer quieter spots, less walking..."
              placeholderTextColor={Pal.colors.light.textMuted}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity onPress={() => setRefineModalVisible(false)} disabled={refining} style={{ flex: 1, height: 44, borderRadius: Pal.borderRadius.full, backgroundColor: Pal.colors.light.surface, borderWidth: 1, borderColor: Pal.colors.light.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: Pal.colors.light.text, fontFamily: Pal.typography.fontFamily.semibold, fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAiRefine} disabled={refining} style={{ flex: 1, height: 44, borderRadius: Pal.borderRadius.full, backgroundColor: Pal.colors.light.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                {refining ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 14 }}>🪄</Text>}
                <Text style={{ color: '#fff', fontFamily: Pal.typography.fontFamily.semibold, fontSize: 13 }}>{refining ? 'Refining...' : 'Refine with AI'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
