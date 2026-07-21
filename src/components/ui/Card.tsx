import React, { forwardRef, useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Pal from '../../design/DesignSystem';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  onPress?: () => void;
  style?: any;
  testID?: string;
}

const variantStyles = (colors: typeof Pal.colors.dark, variant: CardProps['variant'] = 'default') => {
  switch (variant) {
    case 'default':
      return { bg: colors.surface, border: 'transparent', shadow: 'sm' };
    case 'elevated':
      return { bg: colors.surfaceElevated, border: 'transparent', shadow: 'lg' };
    case 'outlined':
      return { bg: colors.surface, border: colors.border, shadow: 'none' };
    case 'glass':
      return { bg: colors.surface + 'CC', border: colors.border, shadow: 'md' };
  }
};

const paddingMap = {
  none: 0,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
};

export const Card = forwardRef<React.ComponentRef<typeof View>, CardProps>(
  ({ children, variant = 'default', padding = 'md', onPress, style, testID, ...props }, ref) => {
    const colors = Pal.colors.dark;
    const v = useMemo(() => variantStyles(colors, variant), [colors, variant]);
    const p = useMemo(() => paddingMap[padding], [padding]);
    const shadows = useMemo(
      () => Pal.shadows[v.shadow as keyof typeof Pal.shadows] || Pal.shadows.none,
      [v.shadow]
    );

    const containerStyle = useMemo(() => [
      styles.container,
      { backgroundColor: v.bg, borderColor: v.border, borderWidth: v.border === 'transparent' ? 0 : 1 },
      shadows,
      p > 0 && { padding: p },
      style,
    ], [v.bg, v.border, shadows, p, style]);

    if (onPress) {
      return (
        <TouchableOpacity
          ref={ref}
          {...props}
          onPress={onPress}
          activeOpacity={0.9}
          style={containerStyle}
          testID={testID}
        >
          {children}
        </TouchableOpacity>
      );
    }

    return <View ref={ref} {...props} style={containerStyle} testID={testID}>{children}</View>;
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: any;
}

export const CardHeader = React.memo(({ title, subtitle, action, style }: CardHeaderProps) => (
  <View style={[styles.header, style]}>
    <View style={styles.headerContent}>
      <Text style={styles.headerTitle}>{title}</Text>
      {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
    </View>
    {action && <View style={styles.headerAction}>{action}</View>}
  </View>
));

export interface CardFooterProps {
  children: React.ReactNode;
  style?: any;
}

export const CardFooter = React.memo(({ children, style }: CardFooterProps) => (
  <View style={[styles.footer, style]}>{children}</View>
));

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Pal.colors.dark.borderSoft,
  },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Pal.colors.dark.text },
  headerSubtitle: { fontSize: 13, color: Pal.colors.dark.textMuted, marginTop: 2 },
  headerAction: { marginLeft: 12 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Pal.colors.dark.borderSoft,
    gap: 12,
  },
});

export default Card;