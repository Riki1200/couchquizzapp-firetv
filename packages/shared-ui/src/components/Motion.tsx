import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  LayoutChangeEvent,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

// Transforms and opacity run on the native driver on TV platforms (smooth even when JS is busy).
export const nativeDriver = Platform.OS !== 'web';

/** Fades and slides its children in when mounted. */
export function FadeIn({
  children,
  delay = 0,
  distance = 24,
  duration = 380,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    }).start();
  }, [progress, delay, duration]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** Scales its children in with a little bounce when mounted. */
export function PopIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, delay, friction: 5, tension: 140, useNativeDriver: nativeDriver }).start();
  }, [scale, delay]);
  return <Animated.View style={[style, { opacity: scale.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }), transform: [{ scale }] }]}>{children}</Animated.View>;
}

/** Springs between 0 (idle) and 1 (focused); use it to scale or glow a focusable element. */
export function useFocusSpring(isFocused: boolean) {
  const value = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(value, { toValue: isFocused ? 1 : 0, friction: 6, tension: 180, useNativeDriver: nativeDriver }).start();
  }, [isFocused, value]);
  return value;
}

/** Restarts a short "pulse" (1 → 1.25 → 1) every time `trigger` changes. */
export function usePulse(trigger: unknown, enabled = true) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!enabled) return;
    scale.setValue(1.25);
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: nativeDriver }).start();
  }, [trigger, enabled, scale]);
  return scale;
}

/**
 * Countdown bar that drains smoothly over `durationMs` (one native animation instead of
 * re-rendering every few hundred milliseconds). The fill slides out to the left.
 */
export function CountdownBar({ durationMs, style, fillStyle }: { durationMs: number; style?: StyleProp<ViewStyle>; fillStyle?: StyleProp<ViewStyle> }) {
  const [width, setWidth] = useState(0);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    progress.setValue(1);
    const animation = Animated.timing(progress, { toValue: 0, duration: durationMs, easing: Easing.linear, useNativeDriver: nativeDriver });
    animation.start();
    return () => animation.stop();
  }, [durationMs, progress]);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] });
  return (
    <Animated.View style={[{ overflow: 'hidden' }, style]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[{ width: '100%', height: '100%' }, fillStyle, { transform: [{ translateX }] }]} />
    </Animated.View>
  );
}

/** Shows `value` counting up from the previous value (or from 0 on mount). */
export function CountUp({ value, duration = 900, style }: { value: number; duration?: number; style?: StyleProp<TextStyle> }) {
  const animated = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = animated.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(animated, { toValue: value, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => animated.removeListener(id);
  }, [value, duration, animated]);
  return <Text style={style}>{shown}</Text>;
}

const CONFETTI_COLORS = ['#FFD23F', '#14B8A6', '#F97316', '#EC4899', '#6366F1', '#2ECC71', '#FFFFFF'];

/** One burst of confetti falling over the whole screen (pointer-transparent). */
export function Confetti({ pieces = 60, delay = 0 }: { pieces?: number; delay?: number }) {
  const { width, height } = Dimensions.get('window');
  const items = useRef(
    Array.from({ length: pieces }, () => ({
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 160,
      size: 8 + Math.random() * 10,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      spin: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 4),
      duration: 2600 + Math.random() * 1800,
      delay: delay + Math.random() * 900,
      progress: new Animated.Value(0),
    })),
  ).current;
  useEffect(() => {
    Animated.parallel(
      items.map((p) =>
        Animated.timing(p.progress, { toValue: 1, duration: p.duration, delay: p.delay, easing: Easing.in(Easing.quad), useNativeDriver: nativeDriver }),
      ),
    ).start();
  }, [items]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: -30,
            width: p.size,
            height: p.size * 0.6,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: p.progress.interpolate({ inputRange: [0, 0.05, 0.85, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, height + 60] }) },
              { translateX: p.progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, p.drift, p.drift * 0.4] }) },
              { rotate: p.progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin * 360}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
