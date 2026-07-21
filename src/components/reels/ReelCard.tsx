import React, { useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Reel } from '../../types';
import { ReelPlayer } from './ReelPlayer';
import { ReelActions, showReelMenu } from './ReelActions';
import { ReelInfo } from './ReelInfo';
import LinearGradient from 'react-native-linear-gradient';

interface ReelCardProps {
  reel: Reel;
  isActive: boolean;
  isLiked: boolean;
  isSaved: boolean;
  isFollowing?: boolean;
  itemHeight?: number;
  onLike: (reelId: string) => void;
  onComment: (reelId: string) => void;
  onShare: (reel: Reel) => void;
  onSave: (reelId: string) => void;
  onFollow?: (creatorId: string) => void;
  onReport?: (reelId: string) => void;
  onOpenPlace?: (placeId: string) => void;
  onOpenVendor?: (vendorId: string) => void;
}

export const ReelCard: React.FC<ReelCardProps> = React.memo(({
  reel,
  isActive,
  isLiked,
  isSaved,
  isFollowing = false,
  itemHeight,
  onLike,
  onComment,
  onShare,
  onSave,
  onFollow,
  onReport,
  onOpenPlace,
  onOpenVendor,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const height = itemHeight || windowHeight;

  const handleLike = useCallback(() => onLike(reel.id), [reel.id, onLike]);
  const handleComment = useCallback(() => onComment(reel.id), [reel.id, onComment]);
  const handleShare = useCallback(() => onShare(reel), [reel, onShare]);
  const handleSave = useCallback(() => onSave(reel.id), [reel.id, onSave]);
  const handleFollow = useCallback(() => {
    if (reel.creator?.id) onFollow?.(reel.creator.id);
  }, [reel.creator?.id, onFollow]);
  const handleMenu = useCallback(() => {
    showReelMenu(() => onReport?.(reel.id));
  }, [reel.id, onReport]);
  const handleOpenPlace = useCallback(() => {
    if (reel.placeId && onOpenPlace) onOpenPlace(reel.placeId);
  }, [reel.placeId, onOpenPlace]);
  const handleOpenVendor = useCallback(() => {
    if (reel.vendorId && onOpenVendor) onOpenVendor(reel.vendorId);
  }, [reel.vendorId, onOpenVendor]);

  const commentCount = Array.isArray(reel.comments)
    ? reel.comments.length
    : (reel as any).commentsCount || 0;

  return (
    <View style={[styles.container, { height, width: windowWidth }]}>
      <ReelPlayer
        videoUrl={reel.videoUrl}
        posterUrl={reel.thumbnail}
        isActive={isActive}
        fallbackSeed={reel.id || reel.videoUrl}
      />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.75)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />

      <ReelActions
        isLiked={isLiked}
        isSaved={isSaved}
        likeCount={reel.likes}
        commentCount={commentCount}
        shareCount={reel.shares}
        saveCount={reel.saves}
        audioThumbnail={reel.thumbnail || reel.creator?.avatar}
        onLike={handleLike}
        onComment={handleComment}
        onShare={handleShare}
        onSave={handleSave}
        onMenu={handleMenu}
      />

      <ReelInfo
        creator={{
          id: reel.creator?.id,
          username: reel.creator?.username || 'Unknown',
          avatar: reel.creator?.avatar || null,
          verified: reel.creator?.verified || false,
        }}
        title={reel.title}
        description={reel.description}
        placeName={reel.place?.name}
        placeCity={reel.place?.city}
        vendorName={reel.vendor?.businessName || undefined}
        isFollowing={isFollowing}
        onOpenPlace={reel.placeId ? handleOpenPlace : undefined}
        onOpenVendor={reel.vendorId ? handleOpenVendor : undefined}
        onFollow={handleFollow}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    position: 'relative',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 380,
    zIndex: 5,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 5,
  },
});
