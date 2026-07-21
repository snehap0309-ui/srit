import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ReelActionsProps {
  isLiked: boolean;
  isSaved: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
  audioThumbnail?: string | null;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onMenu: () => void;
}

export const ReelActions: React.FC<ReelActionsProps> = React.memo(({
  isLiked,
  isSaved,
  likeCount,
  commentCount,
  shareCount,
  saveCount,
  audioThumbnail,
  onLike,
  onComment,
  onShare,
  onSave,
  onMenu,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const handleLike = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, friction: 2, tension: 200, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 10, tension: 100, useNativeDriver: true }),
    ]).start();
    onLike();
  };

  const formatCount = (count: number) => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 10_000) return `${(count / 1_000).toFixed(1)}K`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return String(count);
  };

  const spinInterpolate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const ActionBtn = ({
    icon,
    count,
    onPress,
    filled,
    color = '#fff',
    animated,
  }: {
    icon: string;
    count?: number;
    onPress: () => void;
    filled?: boolean;
    color?: string;
    animated?: React.ReactNode;
  }) => (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.8}>
      {animated || (
        <Ionicons
          name={icon as any}
          size={30}
          color={color}
          style={styles.iconShadow}
        />
      )}
      {count != null && <Text style={styles.actionText}>{formatCount(count)}</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ActionBtn
        icon={isLiked ? 'heart' : 'heart-outline'}
        count={likeCount}
        onPress={handleLike}
        color={isLiked ? '#FF2D55' : '#fff'}
        animated={
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={32}
              color={isLiked ? '#FF2D55' : '#fff'}
              style={styles.iconShadow}
            />
          </Animated.View>
        }
      />

      <ActionBtn icon="chatbubble-outline" count={commentCount} onPress={onComment} />
      <ActionBtn icon="paper-plane-outline" count={shareCount} onPress={onShare} />
      <ActionBtn
        icon={isSaved ? 'bookmark' : 'bookmark-outline'}
        count={saveCount}
        onPress={onSave}
        color={isSaved ? '#B9834B' : '#fff'}
      />

      <TouchableOpacity style={styles.actionButton} onPress={onMenu} activeOpacity={0.8}>
        <Ionicons name="ellipsis-vertical" size={26} color="#fff" style={styles.iconShadow} />
      </TouchableOpacity>

      <View style={styles.audioWrap}>
        <Animated.View style={[styles.audioDisc, { transform: [{ rotate: spinInterpolate }] }]}>
          {audioThumbnail ? (
            <Image source={{ uri: audioThumbnail }} style={styles.audioImg} />
          ) : (
            <View style={styles.audioFallback}>
              <Ionicons name="musical-notes" size={14} color="#fff" />
            </View>
          )}
        </Animated.View>
        <View style={styles.audioNote}>
          <Ionicons name="musical-note" size={10} color="#fff" />
        </View>
      </View>
    </View>
  );
});

export function showReelMenu(onReport?: () => void) {
  Alert.alert('Reel options', undefined, [
    { text: 'Report', style: 'destructive', onPress: onReport },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 10,
    bottom: 130,
    alignItems: 'center',
    gap: 20,
    zIndex: 20,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  audioWrap: {
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioDisc: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  audioImg: { width: '100%', height: '100%' },
  audioFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(185,131,75,0.6)',
  },
  audioNote: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});
