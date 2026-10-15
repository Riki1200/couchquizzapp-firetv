import React from 'react';
import { BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { FocusableButton } from '../components/Focusable';
import { useGame } from '../game/GameContext';
import { Player } from '../game/types';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

const STEP_HEIGHTS = [scaledPixels(260), scaledPixels(190), scaledPixels(140)];
const MEDALS = ['🥇', '🥈', '🥉'];

interface Props {
  onPlayAgain: () => void;
}

export default function PodiumScreen({ onPlayAgain }: Props) {
  const { state } = useGame();
  useBackHandler(onPlayAgain);
  const ranked = [...state.players].sort((a, b) => b.score - a.score);
  // Podium order on screen: 2nd, 1st, 3rd.
  const podium = [ranked[1], ranked[0], ranked[2]].map((player, i) => ({ player, place: [1, 0, 2][i] }));
  const playerById = (id: string) => state.players.find((p) => p.id === id);

  return (
    <SpatialNavigationRoot>
      <View style={styles.container}>
        <Text style={styles.title}>Final scores</Text>

        <View style={styles.body}>
          <View style={styles.podium}>
            {podium.map(({ player, place }) => (player ? <Step key={player.id} player={player} place={place} /> : null))}
          </View>

          <View style={styles.awards}>
            <Text style={styles.awardsTitle}>🏆 Awards from the AI host</Text>
            {state.awards === null ? (
              <Text style={styles.awardLine}>The host is writing the awards…</Text>
            ) : (
              state.awards.map((award) => {
                const player = playerById(award.playerId);
                return (
                  <View key={award.playerId} style={styles.award}>
                    <Text style={styles.awardTitle}>
                      {player?.avatar} {player?.name}: {award.title}
                    </Text>
                    <Text style={styles.awardLine}>{award.line}</Text>
                  </View>
                );
              })
            )}
          </View>
        </View>

        <SpatialNavigationView direction="horizontal" style={styles.buttons}>
          <DefaultFocus>
            <FocusableButton label="Play again ▶" onSelect={onPlayAgain} />
          </DefaultFocus>
          {Platform.OS !== 'web' ? <FocusableButton label="Exit" onSelect={() => BackHandler.exitApp()} /> : null}
        </SpatialNavigationView>
      </View>
    </SpatialNavigationRoot>
  );
}

function Step({ player, place }: { player: Player; place: number }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepAvatar}>{player.avatar}</Text>
      <Text style={styles.stepName} numberOfLines={1}>
        {player.name}
      </Text>
      <Text style={styles.stepScore}>{player.score}</Text>
      <View style={[styles.stepBlock, { height: STEP_HEIGHTS[place] }, place === 0 && styles.stepFirst]}>
        <Text style={styles.medal}>{MEDALS[place]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: scaledPixels(120),
    paddingVertical: scaledPixels(60),
  },
  title: { color: colors.focus, fontSize: scaledPixels(72), fontWeight: 'bold' },
  body: { flex: 1, flexDirection: 'row', gap: scaledPixels(80), marginTop: scaledPixels(30) },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: scaledPixels(24) },
  step: { alignItems: 'center', width: scaledPixels(240) },
  stepAvatar: { fontSize: scaledPixels(96) },
  stepName: { color: colors.text, fontSize: scaledPixels(34), fontWeight: 'bold' },
  stepScore: { color: colors.textSecondary, fontSize: scaledPixels(30), marginBottom: scaledPixels(12) },
  stepBlock: {
    width: '100%',
    backgroundColor: colors.cardRaised,
    borderTopLeftRadius: scaledPixels(16),
    borderTopRightRadius: scaledPixels(16),
    alignItems: 'center',
    paddingTop: scaledPixels(16),
  },
  stepFirst: { backgroundColor: colors.selected },
  medal: { fontSize: scaledPixels(64) },
  awards: { flex: 1, gap: scaledPixels(20) },
  awardsTitle: { color: colors.text, fontSize: scaledPixels(40), fontWeight: 'bold' },
  award: { backgroundColor: colors.card, borderRadius: scaledPixels(16), padding: scaledPixels(20) },
  awardTitle: { color: colors.focus, fontSize: scaledPixels(32), fontWeight: 'bold' },
  awardLine: { color: colors.textSecondary, fontSize: scaledPixels(28), marginTop: scaledPixels(4) },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: scaledPixels(32), marginTop: scaledPixels(24) },
});
