import { TouchableOpacity, Text, View, type ViewStyle, type TextStyle } from 'react-native';
import { Pal } from '../../design/DesignSystem';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  gradient?: string[];
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'outline' | 'ghost';
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantMap: Record<string, { colors: string[]; textColor: string }> = {
  primary: { colors: ['#63300E', '#8B6B3A'], textColor: '#FFF9F2' },
  secondary: { colors: ['#B9834B', '#D4A87A'], textColor: '#FFF9F2' },
  accent: { colors: ['#B9834B', '#D4A87A'], textColor: '#FFF9F2' },
  danger: { colors: ['#FF5A5F', '#FF7B7F'], textColor: '#FFFFFF' },
  outline: { colors: ['transparent', 'transparent'], textColor: '#B9834B' },
  ghost: { colors: ['transparent', 'transparent'], textColor: '#8B7355' },
};

const sizeMap: Record<string, { height: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { height: 36, paddingHorizontal: 16, fontSize: 13 },
  md: { height: 48, paddingHorizontal: 24, fontSize: 15 },
  lg: { height: 56, paddingHorizontal: 32, fontSize: 17 },
};

export function GradientButton({
  title, onPress, style, textStyle, disabled, loading,
  size = 'md', variant = 'primary', icon, fullWidth,
}: GradientButtonProps) {
  const config = variantMap[variant];
  const dims = sizeMap[size];
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[{
        height: dims.height,
        paddingHorizontal: dims.paddingHorizontal,
        borderRadius: Pal.borderRadius.xl,
        backgroundColor: isOutline || isGhost ? 'transparent' : config.colors[0],
        borderWidth: isOutline ? 1.5 : 0,
        borderColor: isOutline ? Pal.colors.light.primary : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: disabled ? 0.5 : 1,
        ...Pal.shadows.md,
      }, fullWidth ? { width: '100%' } : {}, style as ViewStyle]}
    >
      {icon && <View style={{ marginRight: 4 }}>{icon}</View>}
      {loading ? (
        <Text style={[{ color: config.textColor, fontSize: dims.fontSize, fontFamily: Pal.typography.fontFamily.semibold }, textStyle as TextStyle]}>
          Loading...
        </Text>
      ) : (
        <Text style={[{ color: isOutline ? Pal.colors.light.primary : isGhost ? Pal.colors.light.textSecondary : config.textColor, fontSize: dims.fontSize, fontFamily: Pal.typography.fontFamily.semibold }, textStyle as TextStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
