import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Animated,
  TouchableOpacity, StatusBar, Platform, ScrollView, Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';

const { width: W, height: H } = Dimensions.get('window');
const IS_IOS = Platform.OS === 'ios';
const TOP_SAFE = IS_IOS ? 54 : (StatusBar.currentHeight || 24) + 8;
const BOTTOM_SAFE = IS_IOS ? 34 : 16;

const C = {
  bg: '#FFF9F2',
  surface: '#FBEFE2',
  gold: '#B9834B',
  cta: '#63300E',
  text: '#2C1810',
  textSub: '#8B7355',
  textMuted: '#B8A88A',
  border: 'rgba(200, 155, 60, 0.15)',
};

const SLIDES = [
  {
    title: '',
    subtitle: '',
    image: require('../assets/onboarding_1.png'),
  },
  {
    title: '',
    subtitle: '',
    image: require('../assets/ai_trip_palnner.png'),
  },
  {
    title: '',
    subtitle: '',
    image: require('../assets/earn_expo.png'),
  },
];

function SlideContent({ slide, isActive, index }: { slide: typeof SLIDES[0]; isActive: boolean; index: number }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const titleUp = useRef(new Animated.Value(30)).current;
  const subUp = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!isActive) {
      fadeIn.setValue(0);
      titleUp.setValue(30);
      subUp.setValue(20);
      return;
    }
    fadeIn.setValue(0);
    titleUp.setValue(30);
    subUp.setValue(20);

    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(titleUp, { toValue: 0, tension: 80, friction: 14, useNativeDriver: true }),
      Animated.spring(subUp, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
    ]).start();
  }, [isActive]);

  const titleParts = slide.title.split(' ');
  const highlightIdx = index === 0 ? 1 : 0;

  return (
    <Animated.View
      style={{
        width: W,
        alignItems: 'center',
        opacity: fadeIn,
        paddingTop: H * 0.12,
      }}
      pointerEvents="none"
    >
      <Animated.View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          paddingHorizontal: 40,
          transform: [{ translateY: titleUp }],
        }}
      >
        {titleParts.map((word, i) => (
          <Text
            key={`${word}-${i}`}
            style={{
              fontSize: 36,
              fontWeight: '700',
              color: i === highlightIdx ? C.gold : C.text,
              letterSpacing: -0.5,
              marginRight: 8,
            }}
          >
            {word}
          </Text>
        ))}
      </Animated.View>

      <Animated.Text
        style={{
          fontSize: 15,
          color: C.textSub,
          textAlign: 'center',
          lineHeight: 22,
          marginTop: 12,
          paddingHorizontal: 44,
          transform: [{ translateY: subUp }],
        }}
      >
        {slide.subtitle}
      </Animated.Text>
    </Animated.View>
  );
}

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const doneOnceRef = useRef(false);
  const pageRef = useRef(0);

  const finishOnboarding = useCallback(() => {
    if (doneOnceRef.current) return;
    doneOnceRef.current = true;
    onDone();
  }, [onDone]);

  const handleScroll = useCallback((e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newPage = Math.round(offsetX / W);
    if (newPage >= 0 && newPage < SLIDES.length && newPage !== pageRef.current) {
      pageRef.current = newPage;
      setPage(newPage);
    }
  }, []);

  const goNext = useCallback(() => {
    const current = pageRef.current;
    if (current >= SLIDES.length - 1) {
      finishOnboarding();
      return;
    }
    const next = current + 1;
    pageRef.current = next;
    setPage(next);
    scrollRef.current?.scrollTo({ x: next * W, animated: true });
  }, [finishOnboarding]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={StyleSheet.absoluteFill}>
        <Image
          source={SLIDES[page].image}
          style={{ width: W, height: H }}
          resizeMode="cover"
        />
      </View>

      {page < SLIDES.length - 1 && (
        <TouchableOpacity
          onPress={finishOnboarding}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            position: 'absolute',
            top: TOP_SAFE - 6,
            right: 16,
            zIndex: 10,
            paddingVertical: 6,
            paddingHorizontal: 16,
            borderRadius: 16,
            backgroundColor: C.surface,
            borderWidth: 1,
            borderColor: C.border,
          }}
        >
          <Text style={{ color: C.textSub, fontSize: 14, fontWeight: '600' }}>Skip</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
        decelerationRate="fast"
        style={{ flex: 1 }}
        // Never finish onboarding from scroll alone
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={{ width: W, justifyContent: 'flex-start' }}>
            <SlideContent slide={slide} isActive={page === i} index={i} />
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 32, paddingBottom: BOTTOM_SAFE + 20, paddingTop: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
            gap: 8,
          }}
        >
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === page ? 28 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === page ? C.gold : '#F5E6C8',
              }}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={goNext}
          activeOpacity={0.85}
          style={{
            height: 48,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            overflow: 'hidden',
          }}
        >
          <LinearGradient
            colors={[C.cta, C.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFF9F2', letterSpacing: 0.5, zIndex: 1 }}>
            {page === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          {page < SLIDES.length - 1 && (
            <Icon name="arrow-forward" size={20} color="#FFF9F2" style={{ zIndex: 1 }} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
