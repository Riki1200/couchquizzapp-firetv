import React, { forwardRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SpatialNavigationFocusableView, SpatialNavigationNodeRef } from 'react-tv-space-navigation';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';
import { useFocusSpring } from './Motion';

interface ButtonProps {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

/** D-pad button. Disabled buttons stay focusable (so the reason is readable) but ignore Select. */
export const FocusableButton = forwardRef<SpatialNavigationNodeRef, ButtonProps>(
  ({ label, onSelect, disabled, style }, ref) => {
    const select = () => !disabled && onSelect();
    return (
      <SpatialNavigationFocusableView ref={ref} onSelect={select}>
        {({ isFocused }) => (
          <Pressable onPress={select}>
            <SpringScale focused={isFocused} amount={0.08}>
              <View style={[styles.button, disabled && styles.disabled, isFocused && styles.buttonFocused, style]}>
                <Text style={[styles.buttonText, isFocused && styles.textFocused]}>{label}</Text>
              </View>
            </SpringScale>
          </Pressable>
        )}
      </SpatialNavigationFocusableView>
    );
  },
);

interface TileProps {
  label: string;
  icon?: string;
  selected: boolean;
  onSelect: () => void;
  width?: number;
}

/**
 * Choice tile. Focused = yellow ring + glow + springy scale (where the D-pad is);
 * selected = purple fill + check mark (what was chosen). Both can be true.
 */
export const OptionTile = forwardRef<SpatialNavigationNodeRef, TileProps>(
  ({ label, icon, selected, onSelect, width }, ref) => (
    <SpatialNavigationFocusableView ref={ref} onSelect={onSelect}>
      {({ isFocused }) => (
        <Pressable onPress={onSelect}>
          <SpringScale focused={isFocused} amount={0.08}>
            <View
              style={[
                styles.tile,
                width ? { width } : null,
                selected && styles.tileSelected,
                isFocused && styles.tileFocused,
              ]}
            >
              {icon ? <Text style={styles.tileIcon}>{icon}</Text> : null}
              <Text style={styles.tileText} numberOfLines={2}>
                {label}
              </Text>
              {selected ? (
                <View style={styles.check}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              ) : null}
            </View>
          </SpringScale>
        </Pressable>
      )}
    </SpatialNavigationFocusableView>
  ),
);

/** Scales its child up with a spring while focused. */
function SpringScale({ focused, amount, children }: { focused: boolean; amount: number; children: React.ReactNode }) {
  const spring = useFocusSpring(focused);
  const scale = spring.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + amount] });
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

const glow = {
  shadowColor: colors.focus,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.85,
  shadowRadius: scaledPixels(24),
  elevation: 12,
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.cardRaised,
    paddingVertical: scaledPixels(22),
    paddingHorizontal: scaledPixels(48),
    borderRadius: scaledPixels(18),
    borderWidth: scaledPixels(5),
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    minWidth: scaledPixels(260),
  },
  disabled: { opacity: 0.5 },
  buttonFocused: { borderColor: colors.focus, backgroundColor: colors.focus, ...glow },
  buttonText: { color: colors.text, fontSize: scaledPixels(32), fontWeight: 'bold' },
  textFocused: { color: colors.textOnFocus },
  tile: {
    width: scaledPixels(300),
    height: scaledPixels(150),
    backgroundColor: 'rgba(26, 33, 72, 0.85)',
    borderRadius: scaledPixels(22),
    borderWidth: scaledPixels(5),
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileSelected: { backgroundColor: colors.selected },
  // Ring only, so the selected fill stays visible while focused.
  tileFocused: { borderColor: colors.focus, ...glow },
  tileIcon: { fontSize: scaledPixels(48), marginBottom: scaledPixels(6) },
  tileText: {
    color: colors.text,
    fontSize: scaledPixels(30),
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: scaledPixels(16),
  },
  check: {
    position: 'absolute',
    top: scaledPixels(10),
    right: scaledPixels(10),
    width: scaledPixels(40),
    height: scaledPixels(40),
    borderRadius: scaledPixels(20),
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: colors.selected, fontSize: scaledPixels(26), fontWeight: 'bold' },
});
