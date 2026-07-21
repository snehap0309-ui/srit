import React, { forwardRef, useRef, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import Pal, { PalColors } from '../../design/DesignSystem';
import Icon from 'react-native-vector-icons/Ionicons';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: string;
  rightIcon?: string;
  fullWidth?: boolean;
  style?: any;
  testID?: string;
}

const variantStyles = (colors: PalColors, variant: ButtonProps['variant'] = 'primary') => {
  switch (variant) {
    case 'primary':
      return {
        bg: colors.primary,
        text: colors.textInverse,
        border: 'transparent',
        activeBg: colors.primaryDark,
      };
    case 'secondary':
      return {
        bg: colors.secondary,
        text: colors.textInverse,
        border: 'transparent',
        activeBg: colors.secondaryDark,
      };
    case 'outline':
      return {
        bg: 'transparent',
        text: colors.primary,
        border: colors.primary,
        activeBg: colors.primarySoft,
      };
    case 'ghost':
      return {
        bg: 'transparent',
        text: colors.textSecondary,
        border: 'transparent',
        activeBg: colors.surfaceHover,
      };
    case 'danger':
      return {
        bg: colors.danger,
        text: colors.textInverse,
        border: 'transparent',
        activeBg: colors.danger,
      };
  }
};

const sizeStyles = (size: ButtonProps['size'] = 'md') => {
  switch (size) {
    case 'sm':
      return { px: 14, py: 8, fontSize: 12, iconSize: 14, radius: 8, gap: 6 };
    case 'md':
      return { px: 20, py: 12, fontSize: 14, iconSize: 16, radius: 10, gap: 8 };
    case 'lg':
      return { px: 28, py: 16, fontSize: 16, iconSize: 18, radius: 12, gap: 10 };
    case 'xl':
      return { px: 32, py: 18, fontSize: 18, iconSize: 20, radius: 14, gap: 12 };
  }
};

export const Button = forwardRef<React.ComponentRef<typeof TouchableOpacity>, ButtonProps>(
  ({ title, onPress, variant = 'primary', size = 'md', disabled = false, loading = false, leftIcon, rightIcon, fullWidth = false, style, testID, ...props }, ref) => {
    const colors = Pal.colors.light;
    const v = useMemo(() => variantStyles(colors, variant), [colors, variant]);
    const s = useMemo(() => sizeStyles(size), [size]);

    const [pressed, setPressed] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      if (!disabled && !loading) {
        setPressed(true);
        Animated.spring(scaleAnim, { toValue: 0.97, friction: 8, useNativeDriver: true }).start();
      }
    };

    const handlePressOut = () => {
      setPressed(false);
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    };

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          ref={ref}
          {...props}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
          disabled={disabled || loading}
          style={[
            styles.button,
            { backgroundColor: pressed && !disabled && !loading ? v.activeBg : v.bg, borderColor: v.border },
            fullWidth && styles.fullWidth,
            s.radius && { borderRadius: s.radius },
            style,
          ]}
          testID={testID}
        >
          {loading ? (
            <ActivityIndicator size="small" color={v.text} style={styles.loading} />
          ) : (
            <View style={[styles.content, { gap: s.gap }]}>
              {leftIcon && <Icon name={leftIcon} size={s.iconSize} color={v.text} />}
              <Text style={[styles.text, { color: v.text, fontSize: s.fontSize }]}>{title}</Text>
              {rightIcon && <Icon name={rightIcon} size={s.iconSize} color={v.text} />}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

Button.displayName = 'Button';

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
  },
  fullWidth: { width: '100%' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '700', letterSpacing: 0.2 },
  loading: { marginHorizontal: 8 },
});

export default Button;