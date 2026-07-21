import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, StatusBar, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Reel } from '../types';
import { ReelFeed } from '../components/reels/ReelFeed';
import { ReelCommentsBottomSheet } from '../components/reels/ReelCommentsBottomSheet';

interface ReelDetailScreenProps {
  reel: Reel;
  reels?: Reel[];
  initialIndex?: number;
  onBack: () => void;
  onLike: (reelId: string) => void;
  onAddComment: (text: string) => void;
  isLiked: boolean;
}

export default function ReelDetailScreen({
  reel,
  reels,
  initialIndex = 0,
  onBack,
  onLike,
  onAddComment,
  isLiked,
}: ReelDetailScreenProps) {
  const [commentReelId, setCommentReelId] = useState<string | null>(null);
  
  const feedData = reels && reels.length > 0 ? reels : [reel];
  
  // Create a liked set for ReelFeed
  const likedReelIds = isLiked ? [reel.id] : [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Back Button */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Icon name="chevron-back" size={28} color="#fff" />
      </TouchableOpacity>

      <ReelFeed
        reels={feedData}
        loading={false}
        error={null}
        hasMore={false}
        likedReelIds={likedReelIds}
        savedReelIds={[]}
        followingCreatorIds={[]}
        onLoadMore={() => {}}
        onRefresh={() => {}}
        refreshing={false}
        onLike={onLike}
        onComment={setCommentReelId}
        onShare={() => {}}
        onSave={() => {}}
      />

      {/* Comment Modal */}
      <ReelCommentsBottomSheet
        reelId={commentReelId}
        visible={!!commentReelId}
        onClose={() => setCommentReelId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 12,
    zIndex: 40,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
