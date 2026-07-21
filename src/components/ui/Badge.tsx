import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Pal from '../../design/DesignSystem';
import Icon from 'react-native-vector-icons/Ionicons';

export interface BadgeProps {
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
  style?: any;
}

const variantColors = {
  primary: { bg: Pal.colors.dark.primary, text: '#fff', border: 'transparent' },
  secondary: { bg: Pal.colors.dark.secondary, text: '#fff', border: 'transparent' },
  success: { bg: Pal.colors.dark.success, text: '#fff', border: 'transparent' },
  warning: { bg: Pal.colors.dark.warning, text: '#1A1A2E', border: 'transparent' },
  accent: { bg: Pal.colors.dark.accent, text: '#fff', border: 'transparent' },
  danger: { bg: Pal.colors.dark.danger, text: '#fff', border: 'transparent' },
  outline: { bg: 'transparent', text: Pal.colors.dark.primary, border: Pal.colors.dark.primary },
  ghost: { bg: Pal.colors.dark.primary + '15', text: Pal.colors.dark.primary, border: 'transparent' },
};

const sizeStyles = {
  sm: { paddingH: 8, paddingV: 4, fontSize: 11, iconSize: 12, gap: 4, radius: 12 },
  md: { paddingH: 12, paddingV: 6, fontSize: 12, iconSize: 14, gap: 5, radius: 16 },
  lg: { paddingH: 16, paddingV: 8, fontSize: 14, iconSize: 16, gap: 6, radius: 20 },
};

export const Badge = React.memo(({
  label,
  icon,
  variant = 'primary',
  size = 'md',
  onPress,
  style,
}: BadgeProps) => {
  const v = variantColors[variant];
  const s = sizeStyles[size];

  return (
    <TouchableOpacity
      style={[
        styles.badge,
        { backgroundColor: v.bg, borderColor: v.border, borderWidth: v.border !== 'transparent' ? 1 : 0 },
        { paddingHorizontal: s.paddingH, paddingVertical: s.paddingV, borderRadius: s.radius },
        { flexDirection: 'row', alignItems: 'center', gap: s.gap },
        style,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
    >
      {icon && <Icon name={icon} size={s.iconSize} color={v.text} />}
      <Text style={[styles.text, { color: v.text, fontSize: s.fontSize }]}>{label}</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  badge: {},
  text: { fontWeight: '700', letterSpacing: 0.2 },
});

export default Badge;