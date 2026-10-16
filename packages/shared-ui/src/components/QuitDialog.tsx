import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { useGame } from '../game/GameContext';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';
import { FocusableButton } from './Focusable';
import { FadeIn, PopIn } from './Motion';

/** Overlay with its own navigation root; the screen underneath is deactivated while it is open. */
export function QuitDialog({ onKeepPlaying, onQuit }: { onKeepPlaying: () => void; onQuit: () => void }) {
  const { t } = useGame();
  useBackHandler(onKeepPlaying);
  return (
    <FadeIn distance={0} duration={200} style={styles.scrim}>
      <SpatialNavigationRoot>
        <PopIn>
          <View style={styles.card}>
            <Text style={styles.title}>{t('quit.title')}</Text>
            <Text style={styles.text}>{t('quit.text')}</Text>
            <SpatialNavigationView direction="horizontal" style={styles.buttons}>
              <DefaultFocus>
                <FocusableButton label={t('quit.keep')} onSelect={onKeepPlaying} />
              </DefaultFocus>
              <FocusableButton label={t('quit.quit')} onSelect={onQuit} />
            </SpatialNavigationView>
          </View>
        </PopIn>
      </SpatialNavigationRoot>
    </FadeIn>
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
    borderRadius: scaledPixels(28),
    borderWidth: scaledPixels(3),
    borderColor: 'rgba(255, 210, 63, 0.35)',
    padding: scaledPixels(56),
    alignItems: 'center',
  },
  title: { color: colors.text, fontSize: scaledPixels(56), fontWeight: 'bold' },
  text: { color: colors.textSecondary, fontSize: scaledPixels(30), marginTop: scaledPixels(12) },
  buttons: { flexDirection: 'row', gap: scaledPixels(32), marginTop: scaledPixels(40) },
});
