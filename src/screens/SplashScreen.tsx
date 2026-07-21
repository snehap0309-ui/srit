import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  StatusBar,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const C = {
  cream: '#F7EFE0',
  gold: '#BC8F5F',
  ink: '#4A2C2A',
  white: '#FFFFFF',
};

const CTA_HEIGHT = 58;
const CTA_ARROW = CTA_HEIGHT - 12;

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const finishedRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 42, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handlePress = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <Image
        source={require('../assets/splash_screen.png')}
        style={styles.bg}
        resizeMode="cover"
        accessible={false}
        importantForAccessibility="no"
      />

      <Animated.View
        style={[
          styles.bottomBlock,
          {
            paddingBottom: Math.max(insets.bottom, 20),
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.9}
          style={styles.ctaBtn}
          accessibilityRole="button"
          accessibilityLabel="Let's Get Started"
        >
          <Text style={styles.ctaText} numberOfLines={1}>
            Let&apos;s Get Started
          </Text>
          <View style={styles.ctaArrow}>
            <Icon name="arrow-forward" size={22} color={C.white} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1208',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  bottomBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 8,
  },
  ctaBtn: {
    width: '100%',
    maxWidth: 380,
    height: CTA_HEIGHT,
    borderRadius: CTA_HEIGHT / 2,
    backgroundColor: C.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    width: '100%',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: C.ink,
    letterSpacing: 0.1,
    paddingHorizontal: CTA_ARROW + 16,
  },
  ctaArrow: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: CTA_ARROW,
    height: CTA_ARROW,
    borderRadius: CTA_ARROW / 2,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
