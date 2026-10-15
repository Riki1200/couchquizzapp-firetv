import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';
import { Player } from '../game/types';

/** Avatar + name. Disconnected players are dimmed until their phone reconnects. */
export function PlayerAvatar({ player }: { player: Player }) {
  return (
    <View style={[styles.container, !player.connected && styles.disconnected]}>
      <View style={styles.circle}>
        <Text style={styles.emoji}>{player.avatar}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {player.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', width: scaledPixels(170) },
  disconnected: { opacity: 0.35 },
  circle: {
    width: scaledPixels(120),
    height: scaledPixels(120),
    borderRadius: scaledPixels(60),
    backgroundColor: colors.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: scaledPixels(64) },
  name: { color: colors.text, fontSize: scaledPixels(28), fontWeight: 'bold', marginTop: scaledPixels(10) },
});
