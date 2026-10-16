import React from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';
import { FadeIn } from './Motion';

const background = require('../assets/background.png');

/** Full-screen page: gradient background, TV-safe padding, and a short fade-in on mount. */
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={styles.root}>
      <Image source={background} resizeMode="cover" style={styles.background} />
      <FadeIn distance={14} duration={320} style={[styles.content, style]}>
        {children}
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  background: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  content: { flex: 1, paddingHorizontal: scaledPixels(120), paddingVertical: scaledPixels(56) },
});
