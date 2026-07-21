import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ReelInfoProps {
  creator: {
    id?: string;
    username: string;
    avatar: string | null;
    verified: boolean;
  };
  title: string | null;
  description: string | null;
  placeName?: string | null;
  placeCity?: string | null;
  vendorName?: string | null;
  isFollowing?: boolean;
  onOpenPlace?: () => void;
  onOpenVendor?: () => void;
  onFollow?: () => void;
}

function formatLocation(placeName?: string | null, placeCity?: string | null): string | null {
  if (!placeName && !placeCity) return null;
  if (placeName && placeCity && !placeName.toLowerCase().includes(placeCity.toLowerCase())) {
    return `${placeName}, ${placeCity}`;
  }
  return placeName || placeCity || null;
}

export const ReelInfo: React.FC<ReelInfoProps> = React.memo(({
  creator,
  title,
  description,
  placeName,
  placeCity,
  vendorName,
  isFollowing = false,
  onOpenPlace,
  onOpenVendor,
  onFollow,
}) => {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const bottomPadding = Math.max(insets.bottom, 12) + (Platform.OS === 'ios' ? 72 : 76);

  const locationLabel = formatLocation(placeName, placeCity);
  const caption = description || title || '';
  const audioLabel = `Original Audio | ${creator.username}`;

  const handleFollow = useCallback(() => {
    onFollow?.();
  }, [onFollow]);

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      {locationLabel ? (
        <TouchableOpacity style={styles.locationPill} onPress={onOpenPlace} activeOpacity={0.85}>
          <Ionicons name="location-sharp" size={13} color="#fff" />
          <Text style={styles.locationText} numberOfLines={1}>{locationLabel}</Text>
        </TouchableOpacity>
      ) : null}

      {vendorName ? (
        <TouchableOpacity style={[styles.locationPill, { marginTop: locationLabel ? 8 : 0 }]} onPress={onOpenVendor}>
          <Ionicons name="storefront-outline" size={13} color="#fff" />
          <Text style={styles.locationText} numberOfLines={1}>{vendorName}</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.creatorRow}>
        <Image
          source={{ uri: creator.avatar || 'https://via.placeholder.com/150' }}
          style={styles.avatar}
        />
        <Text style={styles.username} numberOfLines={1}>{creator.username}</Text>
        {creator.verified && (
          <Ionicons name="checkmark-circle" size={15} color="#fff" style={styles.verified} />
        )}
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followBtnActive]}
          onPress={handleFollow}
          activeOpacity={0.85}
        >
          <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>

      {!!caption && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setExpanded(v => !v)}
          style={styles.captionContainer}
        >
          <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>
            {caption}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.audioPill}>
        <Ionicons name="musical-notes" size={12} color="#fff" />
        <Text style={styles.audioText} numberOfLines={1}>{audioLabel}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 72,
    paddingHorizontal: 14,
    paddingTop: 24,
    zIndex: 10,
  },
  locationPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.42)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    marginBottom: 10,
    maxWidth: '92%',
  },
  locationText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
    flexWrap: 'nowrap',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  username: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  verified: {
    marginLeft: -4,
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#B9834B',
    marginLeft: 'auto',
  },
  followBtnActive: {
    backgroundColor: 'rgba(185,131,75,0.25)',
  },
  followText: {
    color: '#B9834B',
    fontSize: 13,
    fontWeight: '800',
  },
  followTextActive: {
    color: '#fff',
  },
  captionContainer: {
    marginBottom: 10,
  },
  description: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  audioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    maxWidth: '95%',
  },
  audioText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
});
