import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SpatialNavigationFocusableView, SpatialNavigationNodeRef } from 'react-tv-space-navigation';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

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
          <Pressable
            onPress={select}
            style={[styles.button, disabled && styles.disabled, isFocused && styles.focused, style]}
          >
            <Text style={[styles.buttonText, isFocused && styles.textFocused]}>{label}</Text>
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
}

/**
 * Choice tile. Focused = yellow ring + glow + scale (where the D-pad is);
 * selected = purple fill + check mark (what was chosen). Both can be true.
 */
export const OptionTile = forwardRef<SpatialNavigationNodeRef, TileProps>(
  ({ label, icon, selected, onSelect }, ref) => (
    <SpatialNavigationFocusableView ref={ref} onSelect={onSelect}>
      {({ isFocused }) => (
        <Pressable onPress={onSelect} style={[styles.tile, selected && styles.tileSelected, isFocused && styles.tileFocused]}>
          {icon ? <Text style={styles.tileIcon}>{icon}</Text> : null}
          <Text style={styles.tileText} numberOfLines={2}>
            {label}
          </Text>
          {selected ? (
            <View style={styles.check}>
              <Text style={styles.checkText}>✓</Text>
            </View>
          ) : null}
        </Pressable>
      )}
    </SpatialNavigationFocusableView>
  ),
);

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.cardRaised,
    paddingVertical: scaledPixels(22),
    paddingHorizontal: scaledPixels(48),
    borderRadius: scaledPixels(16),
    borderWidth: scaledPixels(5),
    borderColor: 'transparent',
    alignItems: 'center',
    minWidth: scaledPixels(260),
  },
  disabled: { opacity: 0.55 },
  focused: {
    borderColor: colors.focus,
    backgroundColor: colors.focus,
    transform: [{ scale: 1.08 }],
    shadowColor: colors.focus,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: scaledPixels(20),
    elevation: 10,
  },
  buttonText: { color: colors.text, fontSize: scaledPixels(32), fontWeight: 'bold' },
  textFocused: { color: colors.textOnFocus },
  tile: {
    width: scaledPixels(300),
    height: scaledPixels(150),
    backgroundColor: colors.card,
    borderRadius: scaledPixels(20),
    borderWidth: scaledPixels(5),
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileSelected: { backgroundColor: colors.selected },
  // Ring only, so the selected fill stays visible while focused.
  tileFocused: {
    borderColor: colors.focus,
    transform: [{ scale: 1.08 }],
    shadowColor: colors.focus,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: scaledPixels(20),
    elevation: 10,
  },
  tileIcon: { fontSize: scaledPixels(48), marginBottom: scaledPixels(6) },
  tileText: { color: colors.text, fontSize: scaledPixels(30), fontWeight: 'bold', textAlign: 'center', paddingHorizontal: scaledPixels(16) },
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
