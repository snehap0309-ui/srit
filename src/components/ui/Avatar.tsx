import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Pal from '../../design/DesignSystem';

const PRESET_AVATARS = ['👦', '👧', '👨', '👩', '👶', '👸', '🤴', '🧑', '🧒', '👱'];

export interface AvatarProps {
  source?: { uri: string } | null;
  avatarStyle?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  shape?: 'circle' | 'rounded';
  onPress?: () => void;
  status?: 'online' | 'offline' | 'busy' | 'away';
  badge?: string | number;
  style?: any;
}

const sizeMap = {
  xs: { width: 28, height: 28, fontSize: 14, badgeSize: 14, badgeFont: 8 },
  sm: { width: 36, height: 36, fontSize: 18, badgeSize: 16, badgeFont: 9 },
  md: { width: 44, height: 44, fontSize: 22, badgeSize: 18, badgeFont: 10 },
  lg: { width: 56, height: 56, fontSize: 28, badgeSize: 20, badgeFont: 11 },
  xl: { width: 72, height: 72, fontSize: 36, badgeSize: 24, badgeFont: 12 },
  xxl: { width: 96, height: 96, fontSize: 48, badgeSize: 28, badgeFont: 14 },
};

export const Avatar = React.memo(({
  source,
  avatarStyle = 0,
  size = 'md',
  shape = 'circle',
  onPress,
  status,
  badge,
  style,
}: AvatarProps) => {
  const colors = Pal.colors.dark;
  const s = sizeMap[size];
  const radius = useMemo(() => shape === 'circle' ? s.width / 2 : 12, [shape, s.width]);
  const emoji = useMemo(() => PRESET_AVATARS[avatarStyle % PRESET_AVATARS.length] || '🧭', [avatarStyle]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={!onPress} style={[{ width: s.width, height: s.height }, style]}>
      <View style={styles.container}>
        {source?.uri ? (
          <Image source={source} style={[styles.image, { width: s.width, height: s.height, borderRadius: radius }]} resizeMode="cover" fadeDuration={0} />
        ) : (
          <View style={[styles.placeholder, { width: s.width, height: s.height, borderRadius: radius, backgroundColor: colors.primary + '15' }]}>
            <Text style={{ fontSize: s.fontSize }}>{emoji}</Text>
          </View>
        )}

        {status && (
          <View
            style={[
              styles.statusDot,
              {
                width: s.badgeSize * 0.4,
                height: s.badgeSize * 0.4,
                borderRadius: s.badgeSize * 0.2,
                borderWidth: 2,
                borderColor: colors.background,
                backgroundColor:
                  status === 'online' ? colors.success :
                  status === 'busy' ? colors.danger :
                  status === 'away' ? colors.warning :
                  colors.textMuted,
              },
            ]}
          />
        )}

        {badge !== undefined && (
          <View
            style={[
              styles.badge,
              { width: s.badgeSize, height: s.badgeSize, borderRadius: s.badgeSize / 2 },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { fontSize: s.badgeFont, color: '#fff' },
              ]}
            >
              {typeof badge === 'number' && badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  image: { borderRadius: 9999 },
  placeholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: Pal.colors.dark.primary + '15' },
  statusDot: { position: 'absolute', bottom: 0, right: 0 },
  badge: { position: 'absolute', top: -4, right: -4, justifyContent: 'center', alignItems: 'center', backgroundColor: Pal.colors.dark.danger, minWidth: 18, paddingHorizontal: 4 },
  badgeText: { fontWeight: '800', textAlign: 'center' },
});

export default Avatar;