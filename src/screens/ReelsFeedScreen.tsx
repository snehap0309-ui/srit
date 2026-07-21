import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Modal,
  Pressable,
  Alert,
  Share,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useLocationContext } from '../context/LocationContext';
import { useUserContext } from '../context/UserContext';
import { Reel } from '../types';
import { getReelsFeed, likeReel, unlikeReel } from '../services/reelService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReelFeed } from '../components/reels/ReelFeed';
import { ReelCommentsBottomSheet } from '../components/reels/ReelCommentsBottomSheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { DEV_FLAGS } from '../config/devFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_KEY = 'PALSAFAR_SAVED_REELS';
const FOLLOWING_KEY = 'PALSAFAR_FOLLOWING_CREATORS';

const CATEGORIES = [
  'For You',
  'Nearby',
  'Trending',
  'Following',
  'Hidden Gems',
  'Adventure',
  'Food',
  'Culture',
  'Festivals',
  'Road Trips',
];

const GOLD = '#B9834B';

interface ReelsFeedScreenProps {
  onCreateReel?: () => void;
}

function ReelSegmentProgress({ total, activeIndex }: { total: number; activeIndex: number }) {
  const segments = Math.min(Math.max(total, 1), 5);
  return (
    <View style={segStyles.row}>
      {Array.from({ length: segments }).map((_, i) => {
        const filled = i === activeIndex % segments;
        return (
          <View
            key={i}
            style={[segStyles.bar, filled ? segStyles.barActive : segStyles.barInactive]}
          />
        );
      })}
    </View>
  );
}

const segStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
    maxWidth: 120,
    alignItems: 'center',
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  barActive: {
    backgroundColor: GOLD,
  },
  barInactive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});

export default function ReelsFeedScreen({ onCreateReel }: ReelsFeedScreenProps) {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { effectivePosition } = useLocationContext();
  const { user, setUser } = useUserContext();

  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeCategory, setActiveCategory] = useState('For You');
  const [error, setError] = useState<string | null>(null);
  const [commentReelId, setCommentReelId] = useState<string | null>(null);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [savedReelIds, setSavedReelIds] = useState<string[]>([]);
  const [followingCreatorIds, setFollowingCreatorIds] = useState<string[]>([]);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      try {
        const [savedRaw, followingRaw] = await Promise.all([
          AsyncStorage.getItem(SAVED_KEY),
          AsyncStorage.getItem(FOLLOWING_KEY),
        ]);
        if (savedRaw) setSavedReelIds(JSON.parse(savedRaw));
        if (followingRaw) setFollowingCreatorIds(JSON.parse(followingRaw));
      } catch { /* offline */ }
    })();
  }, []);

  const persistSaved = useCallback(async (ids: string[]) => {
    setSavedReelIds(ids);
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  }, []);

  const persistFollowing = useCallback(async (ids: string[]) => {
    setFollowingCreatorIds(ids);
    await AsyncStorage.setItem(FOLLOWING_KEY, JSON.stringify(ids));
  }, []);

  const loadFeed = useCallback(async (reset = false, customCategory = activeCategory) => {
    if (!reset && (!hasMore || loading)) return;
    if (reset) setLoading(true);
    const targetPage = reset ? 1 : page;
    try {
      const coords = customCategory === 'Nearby' && effectivePosition
        ? { latitude: effectivePosition.latitude, longitude: effectivePosition.longitude }
        : undefined;

      const result = await getReelsFeed(
        reset ? undefined : (targetPage - 1) * 5,
        5,
        customCategory,
        coords,
      );

      if (reset) {
        setReels(result.items || []);
        setActiveReelIndex(0);
      } else {
        setReels(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const newItems = (result.items || []).filter(r => !existingIds.has(r.id));
          return [...prev, ...newItems];
        });
      }
      setPage(targetPage + 1);
      setHasMore(result.hasMore);
      if (reset) setError(null);
    } catch {
      if (reset) setError('Failed to load reels. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [page, hasMore, activeCategory, effectivePosition, loading]);

  useEffect(() => {
    loadFeed(true, activeCategory);
  }, [activeCategory]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed(true, activeCategory);
    setRefreshing(false);
  }, [loadFeed, activeCategory]);

  const handleLike = useCallback(async (reelId: string) => {
    if (!user) return;
    const isLiked = (user.likedReels || []).includes(reelId);
    try {
      const updatedLiked = isLiked
        ? (user.likedReels || []).filter(id => id !== reelId)
        : [...(user.likedReels || []), reelId];

      setUser(prev => prev ? { ...prev, likedReels: updatedLiked } : prev);
      setReels(prev => prev.map(r =>
        r.id === reelId ? { ...r, likes: Math.max(0, r.likes + (isLiked ? -1 : 1)) } : r,
      ));

      if (isLiked) await unlikeReel(reelId, user.uid);
      else await likeReel(reelId, user.uid);
    } catch {
      const reverted = isLiked
        ? [...(user.likedReels || []), reelId]
        : (user.likedReels || []).filter(id => id !== reelId);
      setUser(prev => prev ? { ...prev, likedReels: reverted } : prev);
      setReels(prev => prev.map(r =>
        r.id === reelId ? { ...r, likes: Math.max(0, r.likes + (isLiked ? 1 : -1)) } : r,
      ));
    }
  }, [user, setUser]);

  const handleSave = useCallback(async (reelId: string) => {
    const isSaved = savedReelIds.includes(reelId);
    const next = isSaved
      ? savedReelIds.filter(id => id !== reelId)
      : [...savedReelIds, reelId];
    await persistSaved(next);
    setReels(prev => prev.map(r =>
      r.id === reelId ? { ...r, saves: Math.max(0, r.saves + (isSaved ? -1 : 1)) } : r,
    ));

    if (DEV_FLAGS.USE_SERVER_API) {
      try {
        const { socialApi } = require('../services/api/social') as typeof import('../services/api/social');
        if (isSaved) await socialApi.unsaveReel(reelId);
        else await socialApi.saveReel(reelId);
      } catch { /* local state kept */ }
    }
  }, [savedReelIds, persistSaved]);

  const handleFollow = useCallback(async (creatorId: string) => {
    const isFollowing = followingCreatorIds.includes(creatorId);
    const next = isFollowing
      ? followingCreatorIds.filter(id => id !== creatorId)
      : [...followingCreatorIds, creatorId];
    await persistFollowing(next);

    if (DEV_FLAGS.USE_SERVER_API) {
      try {
        const { socialApi } = require('../services/api/social') as typeof import('../services/api/social');
        if (isFollowing) await socialApi.unfollowCreator(creatorId);
        else await socialApi.followCreator(creatorId);
      } catch { /* local state kept */ }
    }
  }, [followingCreatorIds, persistFollowing]);

  const handleShare = useCallback(async (reel: Reel) => {
    try {
      await Share.share({
        message: `Check out this reel on PalSafar! 🎬\n${reel.description || reel.title || ''}`,
      });
      setReels(prev => prev.map(r =>
        r.id === reel.id ? { ...r, shares: r.shares + 1 } : r,
      ));
    } catch { /* cancelled */ }
  }, []);

  const handleReport = useCallback(async (reelId: string) => {
    if (DEV_FLAGS.USE_SERVER_API) {
      try {
        const { socialApi } = require('../services/api/social') as typeof import('../services/api/social');
        await socialApi.reportReel(reelId, 'Inappropriate content');
        Alert.alert('Reported', 'Thank you. Our team will review this reel.');
        return;
      } catch { /* fall through */ }
    }
    Alert.alert('Reported', 'Thank you for helping keep PalSafar safe.');
  }, []);

  const handleCreatePress = () => {
    if (onCreateReel) onCreateReel();
    else navigation.navigate('CreateReel');
  };

  const handleOpenPlace = useCallback((placeId: string) => {
    navigation.navigate('SpotDetail', { spotId: placeId });
  }, [navigation]);

  const handleOpenVendor = useCallback((vendorId: string) => {
    navigation.navigate('VendorProfile', { vendorId });
  }, [navigation]);

  const handleCategorySelect = (cat: string) => {
    setCategoryOpen(false);
    if (cat === 'Nearby' && !effectivePosition) {
      Alert.alert('Location Required', 'Please enable GPS location to see nearby reels.');
      return;
    }
    setActiveCategory(cat);
  };

  const canCreate = !!user?.roles?.some(role =>
    role === 'VENDOR' || role === 'CONTENT_CREATOR' || role === 'ADMIN',
  ) || user?.role === 'vendor' || user?.role === 'creator' || user?.role === 'admin';

  const topPad = Math.max(insets.top, 44);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Top overlay header */}
      <View style={[styles.topBar, { paddingTop: topPad }]}>
        <View style={styles.topLeft}>
          <TouchableOpacity
            onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
            activeOpacity={0.8}
            style={styles.backHit}
          >
            <Icon name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Reels</Text>
          <TouchableOpacity onPress={() => setCategoryOpen(true)} hitSlop={8}>
            <Icon name="chevron-down" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <ReelSegmentProgress total={reels.length} activeIndex={activeReelIndex} />

        <TouchableOpacity
          style={styles.cameraBtn}
          onPress={handleCreatePress}
          activeOpacity={0.85}
          disabled={!canCreate}
        >
          <Icon name="camera-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ReelFeed
        reels={reels}
        loading={loading}
        error={error}
        hasMore={hasMore}
        likedReelIds={user?.likedReels || []}
        savedReelIds={savedReelIds}
        followingCreatorIds={followingCreatorIds}
        onLoadMore={() => loadFeed(false)}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onLike={handleLike}
        onComment={setCommentReelId}
        onShare={handleShare}
        onSave={handleSave}
        onFollow={handleFollow}
        onReport={handleReport}
        onOpenPlace={handleOpenPlace}
        onOpenVendor={handleOpenVendor}
        onRetry={() => loadFeed(true)}
        isTabFocused={isFocused}
        onActiveIndexChange={setActiveReelIndex}
      />

      <ReelCommentsBottomSheet
        reelId={commentReelId}
        visible={!!commentReelId}
        onClose={() => setCommentReelId(null)}
      />

      {/* Category picker */}
      <Modal visible={categoryOpen} transparent animationType="fade" onRequestClose={() => setCategoryOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCategoryOpen(false)}>
          <View style={[styles.categorySheet, { marginTop: topPad + 52 }]}>
            <Text style={styles.sheetTitle}>Browse reels</Text>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.sheetRow, cat === activeCategory && styles.sheetRowActive]}
                onPress={() => handleCategorySelect(cat)}
              >
                <Text style={[styles.sheetRowText, cat === activeCategory && styles.sheetRowTextActive]}>
                  {cat}
                </Text>
                {cat === activeCategory && <Icon name="checkmark" size={18} color={GOLD} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 10,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 100,
  },
  backHit: {
    padding: 4,
  },
  topTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginHorizontal: 2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cameraBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  categorySheet: {
    marginHorizontal: 16,
    backgroundColor: '#FFF9F2',
    borderRadius: 16,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#8B7355',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sheetRowActive: {
    backgroundColor: 'rgba(185,131,75,0.1)',
  },
  sheetRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C1810',
  },
  sheetRowTextActive: {
    color: '#63300E',
    fontWeight: '800',
  },
});
