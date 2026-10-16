import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Platform, StyleProp, ViewStyle } from 'react-native';

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
