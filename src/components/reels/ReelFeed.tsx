import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ViewToken,
  ActivityIndicator,
  Platform,
  Text,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import { Reel } from '../../types';
import { ReelCard } from './ReelCard';
import { ReelErrorView } from './ReelErrorView';
import { ReelSkeleton } from './ReelSkeleton';

interface ReelFeedProps {
  reels: Reel[];
  loading: boolean;
  isTabFocused?: boolean;
  error: string | null;
  hasMore: boolean;
  likedReelIds: string[];
  savedReelIds: string[];
  followingCreatorIds: string[];
  onLoadMore: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  onLike: (reelId: string) => void;
  onComment: (reelId: string) => void;
  onShare: (reel: Reel) => void;
  onSave: (reelId: string) => void;
  onFollow?: (creatorId: string) => void;
  onReport?: (reelId: string) => void;
  onOpenPlace?: (placeId: string) => void;
  onOpenVendor?: (vendorId: string) => void;
  onRetry?: () => void;
  onActiveIndexChange?: (index: number) => void;
}

export const ReelFeed: React.FC<ReelFeedProps> = React.memo(({
  reels,
  loading,
  error,
  hasMore,
  likedReelIds,
  savedReelIds,
  followingCreatorIds,
  onLoadMore,
  onRefresh,
  refreshing,
  onLike,
  onComment,
  onShare,
  onSave,
  onFollow,
  onReport,
  onOpenPlace,
  onOpenVendor,
  onRetry,
  isTabFocused = true,
  onActiveIndexChange,
}) => {
  const { height: windowHeight } = useWindowDimensions();
  const [viewportHeight, setViewportHeight] = useState(windowHeight);
  const [activeIndex, setActiveIndex] = useState(0);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      const idx = viewableItems[0].index;
      setActiveIndex(idx);
      onActiveIndexChange?.(idx);
    }
  }).current;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.height);
    if (next > 0) setViewportHeight(next);
  }, []);

  const renderItem = useCallback(({ item, index }: { item: Reel; index: number }) => (
    <View style={{ height: viewportHeight, width: '100%', overflow: 'hidden' }}>
      <ReelCard
        reel={item}
        itemHeight={viewportHeight}
        isActive={index === activeIndex && isTabFocused}
        isLiked={likedReelIds.includes(item.id)}
        isSaved={savedReelIds.includes(item.id)}
        isFollowing={followingCreatorIds.includes(item.creator?.id || '')}
        onLike={onLike}
        onComment={onComment}
        onShare={onShare}
        onSave={onSave}
        onFollow={onFollow}
        onReport={onReport}
        onOpenPlace={onOpenPlace}
        onOpenVendor={onOpenVendor}
      />
    </View>
  ), [
    viewportHeight, activeIndex, isTabFocused, likedReelIds, savedReelIds,
    followingCreatorIds, onLike, onComment, onShare, onSave, onFollow, onReport,
    onOpenPlace, onOpenVendor,
  ]);

  const keyExtractor = useCallback((item: Reel, index: number) => item.id || `reel-${index}`, []);

  const renderFooter = useCallback(() => {
    if (!hasMore && reels.length > 0) return null;
    if (loading && reels.length > 0) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      );
    }
    return null;
  }, [loading, hasMore, reels.length]);

  if (error && reels.length === 0) {
    return <ReelErrorView message={error} onRetry={onRetry} />;
  }

  if (loading && reels.length === 0) {
    return <ReelSkeleton />;
  }

  if (!loading && reels.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No reels yet</Text>
        <Text style={styles.emptyMessage}>Check back soon for travel stories and adventures.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      <FlatList
        data={reels}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={viewportHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={hasMore && !loading ? onLoadMore : undefined}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshing={refreshing}
        onRefresh={onRefresh}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={Platform.OS === 'ios'}
        getItemLayout={(_, index) => ({
          length: viewportHeight,
          offset: viewportHeight * index,
          index,
        })}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  footerLoader: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 32,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyMessage: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
});
