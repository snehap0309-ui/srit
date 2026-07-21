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

const BG = require('../../assets/splash_scr.png');
const LOGO = require('../../assets/logo1.png');

const C = {
  bg: '#FFF9F2',
  gold: '#B9834B',
  cream: '#FFFCF7',
  card: '#FDF8F2',
  text: '#2C1810',
  textSub: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(185, 131, 75, 0.22)',
  white: '#FFFFFF',
  ink: '#63300E',
  iconBox: '#6B4428',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
  onSignup: () => void;
  onForgotPassword: () => void;
  onGuestContinue: () => void;
  isLoading?: boolean;
}

const FEATURES = [
  { icon: 'map-search-outline', label: 'Explore Places', sub: 'Find amazing destinations.' },
  { icon: 'star-circle-outline', label: 'Earn PalPoints', sub: 'Earn rewards on every journey.' },
  { icon: 'movie-open-play-outline', label: 'Watch Reels', sub: 'Travel stories & inspiration.' },
  { icon: 'gift-outline', label: 'Redeem Rewards', sub: 'Use points for exciting benefits.' },
];

export default function LoginScreen({
  onLogin,
  onSignup,
  onForgotPassword,
  onGuestContinue,
  isLoading = false,
}: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const cardAnim = useRef(new Animated.Value(0)).current;

  const layout = useMemo(() => {
    const usable = H - insets.top - insets.bottom;
    const tight = usable < 760;
    const veryTight = usable < 700;
    return {
      tight,
      veryTight,
      cardW: W - (tight ? 18 : 22),
      logoSize: veryTight ? 72 : tight ? 84 : 96,
      inputH: tight ? 48 : 52,
      btnH: tight ? 48 : 52,
      altH: tight ? 44 : 48,
      titleSize: tight ? 22 : 24,
      showChrome: !keyboardOpen,
    };
  }, [H, W, insets.top, insets.bottom, keyboardOpen]);

  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: 1,
      damping: 16,
      stiffness: 72,
      delay: 160,
      useNativeDriver: true,
    }).start();
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [cardAnim]);

  const cardSlide = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const cardOpacity = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const validate = useCallback(() => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!EMAIL_REGEX.test(email.trim())) e.email = 'Invalid email address';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Min 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [email, password]);

  const handleLogin = useCallback(async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    try {
      const success = await onLogin(email.trim(), password);
      if (!success) {
        setErrors({ password: 'Invalid email or password. Please try again.' });
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (
        err?.status === 429 ||
        msg.toLowerCase().includes('try again in a moment') ||
        msg.toLowerCase().includes('too many login')
      ) {
        Alert.alert('Please try again', 'Please try again in a moment.');
      } else {
        Alert.alert('Connection Error', msg || 'Unable to reach the server. Please check your connection.');
      }
    }
  }, [email, password, onLogin, validate]);

  const handleGoogle = () => {
    Alert.alert('Coming soon', 'Google sign-in will be available in a future update.');
  };

  const inputBorder = (field: 'email' | 'password', hasError: boolean) => {
    if (hasError) return '#EF4444';
    if (focusedField === field) return C.ink;
    return C.border;
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <Image source={BG} style={styles.bgImage} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(255,249,242,0.04)', 'rgba(255,249,242,0.2)', 'rgba(255,249,242,0.55)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.page}>
            <Animated.View
              style={[
                styles.card,
                {
                  width: layout.cardW,
                  opacity: cardOpacity,
                  transform: [{ translateY: cardSlide }],
                  flexShrink: 1,
                },
              ]}
            >
              {layout.showChrome ? (
                <View style={styles.brandInCard}>
                  <Image
                    source={LOGO}
                    style={{ width: layout.logoSize, height: layout.logoSize }}
                    resizeMode="contain"
                  />
                  <Text style={styles.brandName}>— PAL SAFAR —</Text>
                </View>
              ) : null}

              <View style={styles.cardHeader}>
                <View style={styles.welcomeRow}>
                  <Icon name="heart" size={14} color={C.gold} />
                  <Text style={[styles.welcomeTitle, { fontSize: layout.titleSize }]}>Welcome Back</Text>
                  <Icon name="heart" size={14} color={C.gold} />
                </View>
                <Text style={styles.welcomeSub}>Sign in to continue your journey</Text>
              </View>

              <View style={styles.formPad}>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      height: layout.inputH,
                      borderColor: inputBorder('email', !!errors.email),
                      backgroundColor: focusedField === 'email' ? C.white : C.cream,
                    },
                  ]}
                >
                  <View style={styles.inputIconBox}>
                    <Icon name="mail-outline" size={17} color={C.white} />
                  </View>
                  <TextInput
                    placeholder="Mobile Number / Email"
                    placeholderTextColor={C.textMuted}
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (errors.email) setErrors({});
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    style={styles.inputText}
                  />
                </View>
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

                <View
                  style={[
                    styles.inputContainer,
                    {
                      height: layout.inputH,
                      marginTop: 12,
                      borderColor: inputBorder('password', !!errors.password),
                      backgroundColor: focusedField === 'password' ? C.white : C.cream,
                    },
                  ]}
                >
                  <View style={styles.inputIconBox}>
                    <Icon name="lock-closed-outline" size={17} color={C.white} />
                  </View>
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor={C.textMuted}
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (errors.password) setErrors({});
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    style={styles.inputText}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.eyeBtn}
                    hitSlop={8}
                  >
                    <Icon
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={18}
                      color={C.textSub}
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

                <TouchableOpacity onPress={onForgotPassword} style={styles.forgotWrap}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={isLoading}
                  activeOpacity={0.88}
                  style={[styles.primaryButton, { height: layout.btnH }, isLoading && { opacity: 0.75 }]}
                >
                  <LinearGradient
                    colors={['#4D3227', '#8B5A2B', '#C49A6C']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <MaterialCommunityIcons
                    name="image-filter-hdr"
                    size={58}
                    color="rgba(255,255,255,0.14)"
                    style={styles.btnWatermark}
                  />
                  <Text style={styles.primaryButtonText}>
                    {isLoading ? 'Starting...' : 'Start Your Journey'}
                  </Text>
                  <Icon name="arrow-forward" size={18} color={C.white} />
                </TouchableOpacity>

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  onPress={handleGoogle}
                  activeOpacity={0.85}
                  style={[styles.googleBtn, { height: layout.altH }]}
                >
                  <MaterialCommunityIcons name="google" size={18} color="#EA4335" />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={onGuestContinue} style={styles.guestLink} activeOpacity={0.8}>
                  <Text style={styles.guestLinkText}>Continue as Guest</Text>
                </TouchableOpacity>

                <View style={styles.bottomRow}>
                  <Text style={styles.bottomText}>Don&apos;t have an account? </Text>
                  <TouchableOpacity onPress={onSignup}>
                    <Text style={styles.createAccount}>Create Account</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>

            {layout.showChrome ? (
              <View style={[styles.featuresBar, { width: layout.cardW }]}>
                {FEATURES.map((f, i) => (
                  <React.Fragment key={f.label}>
                    {i > 0 ? <View style={styles.featureDivider} /> : null}
                    <View style={styles.featureItem}>
                      <MaterialCommunityIcons name={f.icon as any} size={18} color={C.gold} />
                      <Text style={styles.featureLabel} numberOfLines={1}>
                        {f.label}
                      </Text>
                      {!layout.veryTight ? (
                        <Text style={styles.featureSub} numberOfLines={2}>
                          {f.sub}
                        </Text>
                      ) : null}
                    </View>
                  </React.Fragment>
                ))}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  flex: { flex: 1, overflow: 'hidden' },
  safe: { flex: 1, overflow: 'hidden' },
  bgImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 36,
    overflow: 'hidden',
  },
  brandInCard: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 0,
  },
  brandName: {
    marginTop: -8,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2.2,
    color: C.gold,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  cardHeader: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 2,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  welcomeTitle: {
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  welcomeSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: C.textSub,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(200, 155, 60, 0.16)',
    shadowColor: 'rgba(99, 48, 14, 0.14)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 10,
    maxWidth: '100%',
  },
  formPad: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingRight: 12,
    overflow: 'hidden',
  },
  inputIconBox: {
    width: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.iconBox,
    marginRight: 10,
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: C.text,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    includeFontPadding: false,
  },
  eyeBtn: { padding: 4 },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: 10,
    marginBottom: 14,
  },
  forgotText: {
    fontSize: 13,
    color: C.gold,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    overflow: 'hidden',
  },
  btnWatermark: {
    position: 'absolute',
    right: 6,
    bottom: -6,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.2,
    zIndex: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  googleBtn: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
  },
  guestLink: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 2,
  },
  guestLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSub,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  bottomText: {
    fontSize: 12,
    color: C.textSub,
    fontWeight: '500',
  },
  createAccount: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gold,
  },
  featuresBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(253, 248, 242, 0.96)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(200, 155, 60, 0.18)',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  featureItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  featureDivider: {
    width: 1,
    backgroundColor: C.border,
    marginVertical: 4,
  },
  featureLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '700',
    color: C.ink,
    textAlign: 'center',
  },
  featureSub: {
    marginTop: 2,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '500',
    color: C.textSub,
    textAlign: 'center',
  },
});
