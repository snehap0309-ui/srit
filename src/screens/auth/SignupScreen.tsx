import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Animated,
  useWindowDimensions,
  Image,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

const SPLASH_BG = require('../../assets/splash-bg.jpg');
const LOGO = require('../../assets/logo1.png');

const C = {
  bg: '#FFF9F2',
  gold: '#B9834B',
  cream: '#FFF9F2',
  card: '#FFFFFF',
  hintBg: '#FBEFE2',
  text: '#2C1810',
  textSub: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(185, 131, 75, 0.24)',
  white: '#FFFFFF',
  ink: '#63300E',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/;

interface SignupScreenProps {
  onSignup: (name: string, email: string, pass: string) => Promise<boolean>;
  onLogin: () => void;
  onGuestContinue: () => void;
  isLoading?: boolean;
}

export default function SignupScreen({ onSignup, onLogin, onGuestContinue, isLoading = false }: SignupScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const cardAnim = useRef(new Animated.Value(0)).current;

  const layout = useMemo(() => {
    const usable = H - insets.top - insets.bottom;
    const tight = usable < 740;
    const cardMargin = tight ? 10 : 12;
    const cardW = W - cardMargin * 2;
    return {
      cardMargin,
      cardW,
      brandH: keyboardOpen ? 0 : tight ? 142 : 158,
      logoSize: tight ? 148 : 168,
      inputH: tight ? 40 : 44,
      btnH: tight ? 42 : 46,
      altH: tight ? 38 : 42,
      gap: tight ? 7 : 8,
      titleSize: tight ? 20 : 22,
      showFooter: !keyboardOpen,
    };
  }, [H, W, insets.top, insets.bottom, keyboardOpen]);

  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: 1,
      damping: 18,
      stiffness: 80,
      delay: 120,
      useNativeDriver: true,
    }).start();
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [cardAnim]);

  const cardSlide = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const cardOpacity = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name required';
    if (!email.trim()) e.email = 'Email required';
    else if (!EMAIL_REGEX.test(email.trim())) e.email = 'Invalid email';
    if (!password) e.password = 'Password required';
    else if (!PASSWORD_REGEX.test(password)) {
      e.password = 'Min 8 chars with uppercase, lowercase, number & special char';
    }
    if (password !== confirmPassword) e.confirmPassword = 'Passwords mismatch';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [name, email, password, confirmPassword]);

  const handleSignup = useCallback(async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    try {
      const success = await onSignup(name.trim(), email.trim(), password);
      if (!success) {
        setErrors({ email: 'An account with this email already exists.' });
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Signup failed. Please try again.');
    }
  }, [name, email, password, onSignup, validate]);

  const inputBorder = (field: string, hasError?: string) => {
    if (hasError) return '#EF4444';
    if (focusedField === field) return C.ink;
    return C.border;
  };

  const handleGoogle = () => {
    Alert.alert('Coming soon', 'Google sign-in will be available in a future update.');
  };

  const renderField = (
    field: string,
    opts: {
      placeholder: string;
      value: string;
      onChange: (t: string) => void;
      icon: string;
      secure?: boolean;
      show?: boolean;
      toggleShow?: () => void;
      keyboardType?: 'email-address' | 'default';
      autoCapitalize?: 'none' | 'words';
      returnKeyType?: 'next' | 'done';
      onSubmit?: () => void;
    },
  ) => (
    <View key={field}>
      <View
        style={[
          styles.inputContainer,
          {
            height: layout.inputH,
            borderColor: inputBorder(field, errors[field]),
            backgroundColor: focusedField === field ? C.white : C.cream,
          },
        ]}
      >
        <Icon name={opts.icon as any} size={17} color={C.gold} style={styles.inputIcon} />
        <TextInput
          placeholder={opts.placeholder}
          placeholderTextColor={C.textMuted}
          value={opts.value}
          onChangeText={(t) => {
            opts.onChange(t);
            if (errors[field]) setErrors({});
          }}
          secureTextEntry={opts.secure && !opts.show}
          keyboardType={opts.keyboardType}
          autoCapitalize={opts.autoCapitalize ?? 'none'}
          autoCorrect={false}
          returnKeyType={opts.returnKeyType ?? 'next'}
          onSubmitEditing={opts.onSubmit}
          onFocus={() => setFocusedField(field)}
          onBlur={() => setFocusedField(null)}
          style={styles.inputText}
        />
        {opts.toggleShow ? (
          <TouchableOpacity onPress={opts.toggleShow} style={styles.eyeBtn} hitSlop={8}>
            <Icon name={opts.show ? 'eye-outline' : 'eye-off-outline'} size={16} color={C.textSub} />
          </TouchableOpacity>
        ) : null}
      </View>
      {errors[field] ? <Text style={styles.errorText}>{errors[field]}</Text> : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <Image source={SPLASH_BG} style={styles.bgImage} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(255,249,242,0.08)', 'rgba(255,249,242,0.28)', 'rgba(255,249,242,0.48)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View
            style={[
              styles.page,
              {
                paddingHorizontal: layout.cardMargin,
                paddingTop: layout.cardMargin,
                paddingBottom: layout.cardMargin,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.card,
                {
                  width: layout.cardW,
                  opacity: cardOpacity,
                  transform: [{ translateY: cardSlide }],
                },
              ]}
            >
              {layout.brandH > 0 ? (
                <View style={styles.brandWrap}>
                  <View style={styles.logoFrame}>
                    <Image
                      source={LOGO}
                      style={{ width: layout.logoSize, height: layout.logoSize }}
                      resizeMode="contain"
                      accessible={false}
                    />
                  </View>
                  <Text style={styles.brandName}>— PAL SAFAR —</Text>
                </View>
              ) : null}

              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { fontSize: layout.titleSize }]}>Create Account</Text>
                <View style={styles.titleDividerRow}>
                  <View style={styles.titleLine} />
                  <Icon name="heart" size={11} color={C.ink} />
                  <View style={styles.titleLine} />
                </View>
                <Text style={styles.cardSubtitle}>Join PalSafar and start exploring</Text>
              </View>

              <View style={[styles.formBlock, { gap: layout.gap }]}>
                {renderField('name', {
                  placeholder: 'Full name',
                  value: name,
                  onChange: setName,
                  icon: 'person-outline',
                  autoCapitalize: 'words',
                })}
                {renderField('email', {
                  placeholder: 'Email address',
                  value: email,
                  onChange: setEmail,
                  icon: 'mail-outline',
                  keyboardType: 'email-address',
                })}
                {renderField('password', {
                  placeholder: 'Create password',
                  value: password,
                  onChange: setPassword,
                  icon: 'lock-closed-outline',
                  secure: true,
                  show: showPassword,
                  toggleShow: () => setShowPassword((v) => !v),
                })}
                {renderField('confirmPassword', {
                  placeholder: 'Confirm password',
                  value: confirmPassword,
                  onChange: setConfirmPassword,
                  icon: 'lock-closed-outline',
                  secure: true,
                  show: showConfirmPassword,
                  toggleShow: () => setShowConfirmPassword((v) => !v),
                  returnKeyType: 'done',
                  onSubmit: handleSignup,
                })}

                {layout.showFooter ? (
                  <View style={styles.hintBox}>
                    <Icon name="shield-checkmark-outline" size={14} color={C.gold} />
                    <Text style={styles.hintText}>
                      Use 8+ characters with a mix of letters, numbers & symbols for a strong password.
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={handleSignup}
                  disabled={isLoading}
                  activeOpacity={0.88}
                  style={[styles.primaryButton, { height: layout.btnH }, isLoading && { opacity: 0.75 }]}
                >
                  <LinearGradient
                    colors={['#4D3227', '#7A4A24', '#B9834B']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <MaterialCommunityIcons
                    name="image-filter-hdr"
                    size={54}
                    color="rgba(255,255,255,0.12)"
                    style={styles.btnWatermark}
                  />
                  <Text style={styles.primaryButtonText}>
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Text>
                  <Icon name="arrow-forward" size={17} color={C.white} />
                </TouchableOpacity>
              </View>

              {layout.showFooter ? (
                <View style={styles.footerBlock}>
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity
                    onPress={handleGoogle}
                    activeOpacity={0.85}
                    style={[styles.altBtn, { height: layout.altH }]}
                  >
                    <MaterialCommunityIcons name="google" size={17} color="#EA4335" />
                    <Text style={styles.altBtnText}>Continue with Google</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={onGuestContinue}
                    activeOpacity={0.85}
                    style={[styles.altBtn, { height: layout.altH, marginTop: layout.gap }]}
                  >
                    <Icon name="person-outline" size={16} color={C.ink} />
                    <Text style={styles.altBtnText}>Continue as Guest</Text>
                  </TouchableOpacity>

                  <View style={styles.bottomRow}>
                    <Text style={styles.bottomText}>Already have an account? </Text>
                    <TouchableOpacity onPress={onLogin}>
                      <Text style={styles.signIn}>Sign In</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.trustRow}>
                    <View style={styles.trustItem}>
                      <Icon name="shield-checkmark-outline" size={11} color={C.textSub} />
                      <Text style={styles.trustText}>Safe</Text>
                    </View>
                    <View style={styles.trustItem}>
                      <Icon name="lock-closed-outline" size={11} color={C.textSub} />
                      <Text style={styles.trustText}>Secure</Text>
                    </View>
                    <View style={styles.trustItem}>
                      <Icon name="checkmark-circle-outline" size={11} color={C.textSub} />
                      <Text style={styles.trustText}>Trusted</Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  flex: { flex: 1 },
  safe: { flex: 1 },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  page: {
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(200, 155, 60, 0.16)',
    shadowColor: 'rgba(99, 48, 14, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
    paddingBottom: 10,
    justifyContent: 'space-between',
  },
  brandWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
    paddingBottom: 0,
    paddingHorizontal: 12,
  },
  logoFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
    marginBottom: -22,
  },
  brandName: {
    marginTop: -14,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.2,
    color: C.gold,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  cardHeader: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 2,
  },
  cardTitle: {
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  titleDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 5,
    width: '70%',
  },
  titleLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  cardSubtitle: {
    fontSize: 11,
    color: C.textSub,
    fontWeight: '500',
    marginTop: 5,
    textAlign: 'center',
  },
  formBlock: {
    paddingHorizontal: 16,
    paddingTop: 2,
  },
  footerBlock: {
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 11,
  },
  inputIcon: {
    marginRight: 7,
  },
  inputText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: C.text,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    includeFontPadding: false,
  },
  eyeBtn: {
    padding: 3,
  },
  errorText: {
    fontSize: 10,
    color: '#EF4444',
    marginTop: 2,
    marginLeft: 4,
    fontWeight: '500',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: C.hintBg,
    borderWidth: 1,
    borderColor: 'rgba(200, 155, 60, 0.12)',
  },
  hintText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 13,
    color: C.textSub,
    fontWeight: '500',
  },
  primaryButton: {
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    overflow: 'hidden',
  },
  btnWatermark: {
    position: 'absolute',
    right: 4,
    bottom: -8,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.2,
    zIndex: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerText: {
    marginHorizontal: 9,
    fontSize: 10,
    color: C.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  altBtn: {
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  altBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.ink,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  bottomText: {
    fontSize: 11,
    color: C.textSub,
    fontWeight: '500',
  },
  signIn: {
    fontSize: 11,
    fontWeight: '700',
    color: C.gold,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 6,
    paddingBottom: 2,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trustText: {
    fontSize: 9,
    color: C.textSub,
    fontWeight: '500',
  },
});
