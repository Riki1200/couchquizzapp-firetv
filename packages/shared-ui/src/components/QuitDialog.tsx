import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';
import { FocusableButton } from './Focusable';

/** Overlay with its own navigation root; the screen underneath is deactivated while it is open. */
export function QuitDialog({ onKeepPlaying, onQuit }: { onKeepPlaying: () => void; onQuit: () => void }) {
  useBackHandler(onKeepPlaying);
  return (
    <View style={styles.scrim}>
      <SpatialNavigationRoot>
        <View style={styles.card}>
          <Text style={styles.title}>Quit this game?</Text>
          <Text style={styles.text}>Scores will be lost. Players stay in the room.</Text>
          <SpatialNavigationView direction="horizontal" style={styles.buttons}>
            <DefaultFocus>
              <FocusableButton label="Keep playing" onSelect={onKeepPlaying} />
            </DefaultFocus>
            <FocusableButton label="Quit to setup" onSelect={onQuit} />
          </SpatialNavigationView>
        </View>
      </SpatialNavigationRoot>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 8, 20, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: scaledPixels(24),
    padding: scaledPixels(56),
    alignItems: 'center',
  },
  title: { color: colors.text, fontSize: scaledPixels(56), fontWeight: 'bold' },
  text: { color: colors.textSecondary, fontSize: scaledPixels(30), marginTop: scaledPixels(12) },
  buttons: { flexDirection: 'row', gap: scaledPixels(32), marginTop: scaledPixels(40) },
});
