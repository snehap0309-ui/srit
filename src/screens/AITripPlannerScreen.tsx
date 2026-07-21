import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { TouristSpot } from '../types';
import { getPlaces } from '../services/placesService';
import { DEV_FLAGS } from '../config/devFlags';
import {
  inferTripDestination,
  buildTripPrompt,
  buildLocalTripPlan,
  applyAiPlanToLocalItinerary,
} from '../utils/tripPlanner';
import { formatDestinationLabel, canonicalizeDestination } from '../utils/destination';
import { useUserContext } from '../context/UserContext';
import { useLocationContext } from '../context/LocationContext';
import type { BudgetTier, TravelPace, Travelers } from '../services/api/trips';

const H_PAD = 20;
const FORM_PAD = 16;
const INTEREST_GAP = 8;
const INTEREST_COLS = 3;

const C = {
  bg: '#FFF9F2',
  surface: '#FFFFFF',
  ink: '#63300E',
  text: '#2C1810',
  textSub: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(200, 155, 60, 0.18)',
  selectedBg: '#FBEFE2',
  stepInactive: '#E8DDD0',
};

const INTERESTS = [
  { emoji: '🛕', label: 'Temples', value: 'temples' },
  { emoji: '🏛️', label: 'Heritage', value: 'heritage' },
  { emoji: '💧', label: 'Waterfalls', value: 'waterfalls' },
  { emoji: '🌿', label: 'Nature', value: 'nature' },
  { emoji: '⛰️', label: 'Adventure', value: 'adventure' },
  { emoji: '🍜', label: 'Food', value: 'food' },
  { emoji: '🛍️', label: 'Shopping', value: 'shopping' },
  { emoji: '💎', label: 'Hidden Gems', value: 'hidden gems' },
  { emoji: '🎨', label: 'Local Culture', value: 'local culture' },
];

const PACES: { key: TravelPace; label: string; desc: string; emoji: string }[] = [
  { key: 'VERY_RELAXED', label: 'Very Relaxed', desc: '2-3 stops/day', emoji: '🧘' },
  { key: 'RELAXED', label: 'Relaxed', desc: '3-4 stops/day', emoji: '😌' },
  { key: 'BALANCED', label: 'Balanced', desc: '5-6 stops/day', emoji: '🚶' },
  { key: 'QUICK', label: 'Quick', desc: '7+ stops/day', emoji: '🏃' },
];

const COMPANIONS: { key: Travelers; label: string; emoji: string }[] = [
  { key: 'SOLO', label: 'Solo', emoji: '🧍' },
  { key: 'COUPLE', label: 'Couple', emoji: '💑' },
  { key: 'FRIENDS', label: 'Friends', emoji: '👥' },
  { key: 'FAMILY', label: 'Family', emoji: '👨‍👩‍👧' },
];

const BUDGETS: { key: BudgetTier; label: string; desc: string }[] = [
  { key: 'LOW', label: 'Low', desc: 'Budget-friendly' },
  { key: 'MEDIUM', label: 'Medium', desc: 'Balanced spend' },
  { key: 'HIGH', label: 'High', desc: 'Comfortable' },
  { key: 'CUSTOM', label: 'Luxury', desc: 'Premium experience' },
];

const POPULAR = [
  { name: 'Manali', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=120&q=80' },
  { name: 'Kerala', image: 'https://images.unsplash.com/photo-1602216050236-7314c96a498b?w=120&q=80' },
  { name: 'Jaipur', image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=120&q=80' },
  { name: 'Goa', image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e672?w=120&q=80' },
  { name: 'Varanasi', image: 'https://images.unsplash.com/photo-1561361513-0997120e5490?w=120&q=80' },
];

const STEPS = [
  { n: 1, title: 'Tell AI', sub: 'Your Preferences' },
  { n: 2, title: 'AI Plan', sub: 'Smart Itinerary' },
  { n: 3, title: 'Review', sub: '& Save Trip' },
];

const PROMPT_MAX = 200;
const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function SelectCard({
  selected,
  onPress,
  emoji,
  label,
  desc,
}: {
  selected: boolean;
  onPress: () => void;
  emoji?: string;
  label: string;
  desc?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.selectCard, selected && styles.selectCardActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {emoji ? <Text style={styles.selectEmoji}>{emoji}</Text> : null}
      <Text style={styles.selectLabel} numberOfLines={1}>{label}</Text>
      {desc ? <Text style={styles.selectDesc} numberOfLines={2}>{desc}</Text> : null}
    </TouchableOpacity>
  );
}

export default function AITripPlannerScreen({ onNavigate }: { onNavigate?: (screen: string, params?: any) => void }) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { effectivePosition } = useLocationContext();
  const { setUser } = useUserContext();

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedPace, setSelectedPace] = useState<TravelPace>('BALANCED');
  const [selectedCompanions, setSelectedCompanions] = useState<Travelers>('SOLO');
  const [selectedBudget, setSelectedBudget] = useState<BudgetTier>('MEDIUM');
  const [days] = useState(3);
  const [customPrompt, setCustomPrompt] = useState('');
  const [destination, setDestination] = useState('');
  const [places, setPlaces] = useState<TouristSpot[]>([]);

  useEffect(() => {
    getPlaces().then(setPlaces).catch(() => setPlaces([]));
  }, []);

  useEffect(() => {
    if (!effectivePosition?.latitude) return;
    let cancelled = false;
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${effectivePosition.latitude}&lon=${effectivePosition.longitude}&zoom=10&addressdetails=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'PalSafar-Mobile/1.0' } },
    )
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.county || '';
        const state = addr.state || '';
        if (city) {
          setDestination(prev => (prev.trim() ? prev : (state ? `${city}, ${state}` : city)));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [effectivePosition?.latitude, effectivePosition?.longitude]);

  const nav = useMemo(
    () => (screen: string, params?: any) => {
      if (onNavigate) onNavigate(screen, params);
      else navigation.navigate(screen, params);
    },
    [onNavigate, navigation],
  );

  const toggleInterest = (value: string) => {
    setSelectedInterests(prev =>
      prev.includes(value) ? prev.filter(i => i !== value) : [...prev, value],
    );
  };

  const resolveLocation = () => {
    const typed = destination.trim();
    if (typed) {
      return formatDestinationLabel(canonicalizeDestination(typed) || typed);
    }
    const inferred = inferTripDestination(customPrompt, selectedInterests);
    return inferred ? formatDestinationLabel(inferred) : '';
  };

  const generateTrip = () => {
    const location = resolveLocation();
    if (!location) {
      Alert.alert('Choose a destination', 'Enter a city (e.g. Jabalpur, Manali, Kerala) or describe it in your prompt.');
      return;
    }

    const prompt = customPrompt.trim() || buildTripPrompt({
      location,
      days,
      pace: selectedPace,
      interests: selectedInterests,
    });

    if (DEV_FLAGS.USE_SERVER_API) {
      nav('SelectPlacesForTrip', {
        destination: location,
        days,
        pace: selectedPace,
        travelers: selectedCompanions,
        budget: selectedBudget,
        interests: selectedInterests,
        prompt,
      });
      return;
    }

    const plan = buildLocalTripPlan({
      location,
      days,
      pace: selectedPace,
      interests: selectedInterests,
      places,
    });
    applyAiPlanToLocalItinerary(plan, setUser, location);
    nav('ItineraryScreen');
  };

  const onPromptChange = (text: string) => {
    if (text.length <= PROMPT_MAX) setCustomPrompt(text);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Icon name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.savedBtn} onPress={() => nav('MyTrips')} activeOpacity={0.85}>
            <Icon name="bookmark-outline" size={16} color={C.text} />
            <Text style={styles.savedBtnText}>Saved Trips</Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>AI Trip Planner ✨</Text>
          <Text style={styles.heroSub}>
            Describe your trip and let AI build the perfect itinerary
          </Text>
        </View>

        {/* Stepper */}
        <View style={styles.stepper}>
          {STEPS.map((step, idx) => {
            const active = step.n === 1;
            return (
              <React.Fragment key={step.n}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepCircle, active && styles.stepCircleActive]}>
                    <Text style={[styles.stepNum, active && styles.stepNumActive]}>{step.n}</Text>
                  </View>
                  <Text style={[styles.stepTitle, active && styles.stepTitleActive]}>{step.title}</Text>
                  <Text style={styles.stepSub}>{step.sub}</Text>
                </View>
                {idx < STEPS.length - 1 && <View style={styles.stepLine} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* Form card */}
        <View style={styles.formCard}>
          <SectionTitle>Where do you want to go?</SectionTitle>
          <Text style={styles.sectionHint}>Tell us the city or place you want to explore</Text>
          <View style={styles.searchRow}>
            <Icon name="location-outline" size={18} color={C.textSub} style={styles.searchIconLeft} />
            <TextInput
              style={styles.searchInput}
              placeholder="e.g. Jabalpur, Manali, Kerala, Jaipur..."
              placeholderTextColor={C.textMuted}
              value={destination}
              onChangeText={setDestination}
              autoCapitalize="words"
            />
            <TouchableOpacity hitSlop={8} onPress={() => {
              if (effectivePosition?.latitude) {
                fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${effectivePosition.latitude}&lon=${effectivePosition.longitude}&zoom=10&addressdetails=1`,
                  { headers: { 'Accept-Language': 'en', 'User-Agent': 'PalSafar-Mobile/1.0' } },
                )
                  .then(r => r.json())
                  .then(data => {
                    const addr = data.address || {};
                    const city = addr.city || addr.town || addr.village || '';
                    const state = addr.state || '';
                    if (city) setDestination(state ? `${city}, ${state}` : city);
                  })
                  .catch(() => {});
              }
            }}>
              <Icon name="locate-outline" size={20} color={C.ink} />
            </TouchableOpacity>
          </View>

          <Text style={styles.popularLabel}>Popular Searches</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularRow}>
            {POPULAR.map(p => (
              <TouchableOpacity
                key={p.name}
                style={styles.popularChip}
                activeOpacity={0.85}
                onPress={() => setDestination(p.name)}
              >
                <Image source={{ uri: p.image }} style={styles.popularThumb} />
                <Text style={styles.popularText}>{p.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.popularChip} activeOpacity={0.85}>
              <View style={styles.moreIconWrap}>
                <MaterialCommunityIcons name="dots-grid" size={16} color={C.textSub} />
              </View>
              <Text style={styles.popularText}>More</Text>
            </TouchableOpacity>
          </ScrollView>

          <SectionTitle>Describe your trip (optional)</SectionTitle>
          <View style={styles.promptBox}>
            <MaterialCommunityIcons name="note-edit-outline" size={16} color={C.textMuted} style={styles.promptIcon} />
            <TextInput
              style={styles.promptInput}
              placeholder="e.g. Family trip, budget stay near old city, prefer sunrise viewpoints, 2 nights 3 days..."
              placeholderTextColor={C.textMuted}
              multiline
              value={customPrompt}
              onChangeText={onPromptChange}
              textAlignVertical="top"
            />
            <Text style={styles.promptCount}>{customPrompt.length}/{PROMPT_MAX}</Text>
          </View>

          <SectionTitle>What are you interested in?</SectionTitle>
          <View style={styles.interestGrid}>
            {chunk(INTERESTS, INTEREST_COLS).map((row, rowIdx) => (
              <View key={`interest-row-${rowIdx}`} style={styles.interestRow}>
                {row.map(item => {
                  const selected = selectedInterests.includes(item.value);
                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[styles.interestTile, selected && styles.interestTileActive]}
                      onPress={() => toggleInterest(item.value)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.interestEmoji}>{item.emoji}</Text>
                      <Text style={[styles.interestLabel, selected && styles.interestLabelActive]} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          <SectionTitle>Travel pace</SectionTitle>
          <View style={styles.selectRow}>
            {PACES.map(p => (
              <SelectCard
                key={p.key}
                selected={selectedPace === p.key}
                onPress={() => setSelectedPace(p.key)}
                emoji={p.emoji}
                label={p.label}
                desc={p.desc}
              />
            ))}
          </View>

          <SectionTitle>Who&apos;s travelling?</SectionTitle>
          <View style={styles.selectRow}>
            {COMPANIONS.map(c => (
              <SelectCard
                key={c.key}
                selected={selectedCompanions === c.key}
                onPress={() => setSelectedCompanions(c.key)}
                emoji={c.emoji}
                label={c.label}
              />
            ))}
          </View>

          <SectionTitle>Budget</SectionTitle>
          <View style={styles.selectRow}>
            {BUDGETS.map(b => (
              <SelectCard
                key={b.key}
                selected={selectedBudget === b.key}
                onPress={() => setSelectedBudget(b.key)}
                label={b.label}
                desc={b.desc}
              />
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.generateBtn} activeOpacity={0.88} onPress={generateTrip}>
          <Text style={styles.generateBtnText}>✨ Generate My Itinerary</Text>
        </TouchableOpacity>

        <View style={styles.footerNote}>
          <Icon name="checkmark-circle" size={14} color={C.textMuted} />
          <Text style={styles.footerNoteText}>
            AI will create the best itinerary based on your preferences
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  savedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  savedBtnText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: C.text },

  hero: { paddingHorizontal: H_PAD, marginBottom: 18 },
  heroTitle: {
    fontSize: 30,
    fontFamily: serif,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: C.textSub,
    marginTop: 6,
    lineHeight: 20,
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: H_PAD,
    marginBottom: 20,
  },
  stepItem: { flex: 1, alignItems: 'center' },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.stepInactive,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepCircleActive: { backgroundColor: C.ink },
  stepNum: { fontSize: 12, fontFamily: 'Inter-Bold', color: C.textSub },
  stepNumActive: { color: '#FFF9F2' },
  stepTitle: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: C.textMuted, textAlign: 'center' },
  stepTitleActive: { color: C.ink },
  stepSub: { fontSize: 9, fontFamily: 'Inter-Medium', color: C.textMuted, textAlign: 'center', marginTop: 1 },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: C.stepInactive,
    marginTop: 13,
    marginHorizontal: -4,
  },

  formCard: {
    marginHorizontal: H_PAD,
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: FORM_PAD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 4,
  },

  sectionTitle: {
    fontSize: 17,
    fontFamily: serif,
    fontWeight: '700',
    color: C.text,
    marginTop: 12,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: C.textSub,
    marginBottom: 10,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 14,
  },
  searchIconLeft: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: C.text,
    paddingVertical: 0,
  },

  popularLabel: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: C.text,
    marginBottom: 8,
  },
  popularRow: { gap: 8, paddingBottom: 4, marginBottom: 6 },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  popularThumb: { width: 28, height: 28, borderRadius: 14 },
  moreIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: C.text },

  promptBox: {
    backgroundColor: C.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 100,
    padding: 12,
    marginBottom: 8,
  },
  promptIcon: { marginBottom: 6 },
  promptInput: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: C.text,
    minHeight: 56,
    lineHeight: 19,
    padding: 0,
  },
  promptCount: {
    alignSelf: 'flex-end',
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: C.textMuted,
    marginTop: 4,
  },

  interestGrid: {
    gap: INTEREST_GAP,
    marginBottom: 8,
  },
  interestRow: {
    flexDirection: 'row',
    gap: INTEREST_GAP,
  },
  interestTile: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    gap: 4,
  },
  interestTileActive: {
    backgroundColor: C.selectedBg,
    borderColor: C.ink,
  },
  interestEmoji: { fontSize: 18 },
  interestLabel: { fontSize: 9, fontFamily: 'Inter-SemiBold', color: C.textSub, textAlign: 'center' },
  interestLabelActive: { color: C.ink },

  selectRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  selectCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    minHeight: 72,
    gap: 2,
  },
  selectCardActive: {
    backgroundColor: C.selectedBg,
    borderColor: C.ink,
  },
  selectEmoji: { fontSize: 20 },
  selectLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: C.text, textAlign: 'center' },
  selectDesc: { fontSize: 8, fontFamily: 'Inter-Medium', color: C.textSub, textAlign: 'center', lineHeight: 11 },

  generateBtn: {
    marginHorizontal: H_PAD,
    marginTop: 20,
    backgroundColor: C.ink,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  generateBtnText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFF9F2',
  },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: H_PAD,
  },
  footerNoteText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: C.textMuted,
    textAlign: 'center',
    flexShrink: 1,
  },
});
