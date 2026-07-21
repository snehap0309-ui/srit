import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Image, ActivityIndicator } from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';

const FALLBACK_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://www.w3schools.com/html/mov_bbb.mp4',
];

function isRemoteVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

function pickFallback(seed?: string): string {
  let hash = 0;
  const key = seed || 'reel';
  for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i) * (i + 1)) % FALLBACK_VIDEOS.length;
  return FALLBACK_VIDEOS[Math.abs(hash) % FALLBACK_VIDEOS.length];
}

interface ReelPlayerProps {
  videoUrl: string;
  posterUrl?: string | null;
  isActive: boolean;
  isPausedOverride?: boolean;
  fallbackSeed?: string;
}

export const ReelPlayer: React.FC<ReelPlayerProps> = React.memo(({
  videoUrl,
  posterUrl,
  isActive,
  isPausedOverride = false,
  fallbackSeed,
}) => {
  const resolvedInitial = useMemo(() => {
    if (isRemoteVideoUrl(videoUrl)) return videoUrl.trim();
    return pickFallback(fallbackSeed || videoUrl);
  }, [videoUrl, fallbackSeed]);

  const [activeUrl, setActiveUrl] = useState(resolvedInitial);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(isActive);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isError, setIsError] = useState(false);

  const playIconOpacity = useRef(new Animated.Value(0)).current;
  const videoRef = useRef<VideoRef>(null);

  useEffect(() => {
    const next = isRemoteVideoUrl(videoUrl)
      ? videoUrl.trim()
      : pickFallback(fallbackSeed || videoUrl);
    setActiveUrl(next);
    setFallbackIndex(0);
    setIsError(false);
    setIsBuffering(true);
  }, [videoUrl, fallbackSeed]);

  useEffect(() => {
    setIsPlaying(!!isActive);
  }, [isActive]);

  const togglePlayPause = () => {
    if (!isActive || isError) return;
    setIsPlaying((prev) => {
      const next = !prev;
      if (prev) {
        Animated.sequence([
          Animated.timing(playIconOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(playIconOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      }
      return next;
    });
  };

  const handleError = () => {
    const candidates = FALLBACK_VIDEOS.filter((u) => u !== activeUrl);
    if (fallbackIndex < candidates.length) {
      const next = candidates[fallbackIndex];
      setFallbackIndex((i) => i + 1);
      setActiveUrl(next);
      setIsBuffering(true);
      setIsError(false);
      return;
    }
    setIsError(true);
    setIsBuffering(false);
  };

  const actuallyPaused = !isActive || !isPlaying || isPausedOverride || isError;
  const showVideo = isRemoteVideoUrl(activeUrl) && !isError;

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={styles.container}
      onPress={togglePlayPause}
      disabled={!showVideo}
    >
      {posterUrl ? (
        <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
      ) : null}

      {showVideo ? (
        <Video
          ref={videoRef}
          key={activeUrl}
          source={{ uri: activeUrl }}
          style={styles.video}
          resizeMode="cover"
          repeat
          paused={actuallyPaused}
          muted={false}
          poster={posterUrl || undefined}
          posterResizeMode="cover"
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
          onLoadStart={() => setIsBuffering(true)}
          onLoad={() => setIsBuffering(false)}
          onReadyForDisplay={() => setIsBuffering(false)}
          onBuffer={({ isBuffering: buffering }) => setIsBuffering(!!buffering)}
          onError={handleError}
          bufferConfig={{
            minBufferMs: 2500,
            maxBufferMs: 10000,
            bufferForPlaybackMs: 1000,
            bufferForPlaybackAfterRebufferMs: 1500,
          }}
        />
      ) : (
        <View style={styles.errorContainer}>
          <Ionicons name="videocam-off-outline" size={48} color="rgba(255,255,255,0.5)" />
        </View>
      )}

      {isActive && isBuffering && showVideo ? (
        <View style={styles.bufferOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : null}

      <View style={styles.overlayCenter} pointerEvents="none">
        <Animated.View
          style={{
            opacity: playIconOpacity,
            transform: [{
              scale: playIconOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.5],
              }),
            }],
          }}
        >
          <Ionicons name="play" size={64} color="rgba(255,255,255,0.7)" />
        </Animated.View>
      </View>

      {!isPlaying && isActive && showVideo ? (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.8)" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
