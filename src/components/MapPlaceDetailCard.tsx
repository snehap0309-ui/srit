import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export type MapDetailMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  type: 'place' | 'vendor';
  image?: string | null;
  rating?: number;
  reviewCount?: number;
  description?: string;
  city?: string;
  state?: string;
  color: string;
  sublabel: string;
  distanceKm?: string;
};

type Props = {
  marker: MapDetailMarker;
  distanceLabel?: string;
  addressLine?: string;
  wishlisted: boolean;
  inItinerary: boolean;
  addingToItinerary?: boolean;
  bottomInset: number;
  onClose: () => void;
  onToggleWishlist: () => void;
  onBookRide: () => void;
  onAddToItinerary: () => void;
  onNavigate: () => void;
  onViewVendor?: () => void;
  onVendorOffers?: () => void;
};

function formatRating(rating?: number, reviewCount?: number): string | null {
  if (!rating) return null;
  const reviews = reviewCount ?? 0;
  if (reviews >= 1000) return `${rating.toFixed(1)} (${(reviews / 1000).toFixed(1)}K)`;
  if (reviews > 0) return `${rating.toFixed(1)} (${reviews})`;
  return rating.toFixed(1);
}

function abbrevState(state?: string): string {
  if (!state) return '';
  const map: Record<string, string> = {
    'madhya pradesh': 'MP',
    'maharashtra': 'MH',
    'uttar pradesh': 'UP',
    'rajasthan': 'RJ',
    'gujarat': 'GJ',
    'karnataka': 'KA',
    'kerala': 'KL',
    'tamil nadu': 'TN',
    'delhi': 'DL',
  };
  return map[state.toLowerCase()] || state;
}

export default function MapPlaceDetailCard({
  marker,
  distanceLabel,
  addressLine,
  wishlisted,
  inItinerary,
  addingToItinerary = false,
  bottomInset,
  onClose,
  onToggleWishlist,
  onBookRide,
  onAddToItinerary,
  onNavigate,
  onViewVendor,
  onVendorOffers,
}: Props) {
  const ratingText = formatRating(marker.rating, marker.reviewCount);
  const isVendor = marker.type === 'vendor';
  const addr =
    addressLine ||
    [marker.city, abbrevState(marker.state)].filter(Boolean).join(', ');

  return (
    <View style={[styles.card, { bottom: bottomInset }]}>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={10}>
        <Icon name="close" size={18} color="#8B7355" />
      </TouchableOpacity>

      <View style={styles.bodyRow}>
        <View style={styles.imageCol}>
          {marker.image ? (
            <Image source={{ uri: marker.image }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imageFallback, { backgroundColor: marker.color + '22' }]}>
              <Icon name="image-outline" size={28} color={marker.color} />
            </View>
          )}
          {!isVendor && (
            <TouchableOpacity style={styles.heartBtn} onPress={onToggleWishlist} hitSlop={8}>
              <Icon
                name={wishlisted ? 'heart' : 'heart-outline'}
                size={16}
                color={wishlisted ? '#EF4444' : '#FFF'}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>{marker.name}</Text>
            {!isVendor && (
              <Icon name="checkmark-circle" size={16} color="#3B82F6" style={styles.verified} />
            )}
          </View>

          {ratingText ? (
            <View style={styles.metaLine}>
              <Icon name="star" size={13} color="#FBBF24" />
              <Text style={styles.ratingText}>{ratingText}</Text>
            </View>
          ) : null}

          {distanceLabel ? (
            <View style={styles.metaLine}>
              <Icon name="location-outline" size={13} color="#63300E" />
              <Text style={styles.metaText}>{distanceLabel}</Text>
            </View>
          ) : null}

          <View style={[styles.tagPill, { backgroundColor: marker.color + '18' }]}>
            <Text style={[styles.tagText, { color: marker.color }]}>{marker.sublabel}</Text>
          </View>

          {!!addr && (
            <View style={styles.metaLine}>
              <Icon name="navigate-outline" size={12} color="#8B7355" />
              <Text style={styles.addressText} numberOfLines={1}>{addr}</Text>
            </View>
          )}

          {!!marker.description && (
            <Text style={styles.description} numberOfLines={2}>{marker.description}</Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.rideBtn} onPress={onBookRide} activeOpacity={0.88}>
          <Icon name="car-outline" size={16} color="#2C1810" />
          <Text style={styles.rideBtnText}>Book a Ride</Text>
        </TouchableOpacity>

        {isVendor ? (
          <>
            <TouchableOpacity style={styles.outlineBtn} onPress={onVendorOffers} activeOpacity={0.88}>
              <Icon name="pricetags-outline" size={15} color="#63300E" />
              <Text style={styles.outlineBtnText}>Offers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={onViewVendor} activeOpacity={0.88}>
              <Icon name="storefront-outline" size={15} color="#FFF9F2" />
              <Text style={styles.navBtnText}>View</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.outlineBtn, (inItinerary || addingToItinerary) && styles.outlineBtnDone]}
              onPress={onAddToItinerary}
              activeOpacity={0.88}
              disabled={inItinerary || addingToItinerary}
            >
              <Icon
                name={inItinerary ? 'checkmark-circle' : addingToItinerary ? 'hourglass-outline' : 'calendar-outline'}
                size={15}
                color={inItinerary ? '#22C55E' : '#63300E'}
              />
              <Text style={[styles.outlineBtnText, inItinerary && { color: '#22C55E' }]}>
                {inItinerary ? 'Added' : addingToItinerary ? 'Adding…' : 'Add to Itinerary'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={onNavigate} activeOpacity={0.88}>
              <Icon name="navigate" size={15} color="#FFF9F2" />
              <Text style={styles.navBtnText}>Navigation</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
    backgroundColor: '#FFF9F2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(200, 155, 60, 0.2)',
    padding: 14,
    shadowColor: '#63300E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyRow: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  imageCol: {
    width: 96,
    position: 'relative',
  },
  image: {
    width: 96,
    height: 118,
    borderRadius: 14,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#2C1810',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  verified: { marginTop: 2 },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C1810',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#63300E',
  },
  tagPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 2,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  addressText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    color: '#8B7355',
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    color: '#8B7355',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  rideBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#D4A87A',
    paddingVertical: 11,
    borderRadius: 12,
  },
  rideBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2C1810',
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#FFF9F2',
    borderWidth: 1.5,
    borderColor: '#63300E',
  },
  outlineBtnDone: {
    borderColor: '#22C55E',
    backgroundColor: '#22C55E10',
  },
  outlineBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#63300E',
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#63300E',
  },
  navBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF9F2',
  },
});
