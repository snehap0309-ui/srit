import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';

const { width: WINDOW_WIDTH } = Dimensions.get('window');
const GRID_ITEM_SIZE = (WINDOW_WIDTH - 4) / 3;

interface GridSkeletonProps {
  count?: number;
}

export const GridSkeleton: React.FC<GridSkeletonProps> = React.memo(({ count = 9 }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [opacity]);

  const animatedStyle = { opacity };

  return (
    <View style={styles.grid}>
      {[...Array(count)].map((_, i) => (
        <Animated.View key={i} style={[styles.gridItem, animatedStyle]} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 1,
    gap: 1,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE * 1.5, // Standard vertical aspect ratio for reels
    backgroundColor: '#333',
  },
});
