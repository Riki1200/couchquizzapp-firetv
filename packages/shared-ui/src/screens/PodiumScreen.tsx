import React from 'react';
import { BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { FocusableButton } from '../components/Focusable';
import { Confetti, CountUp, FadeIn, PopIn } from '../components/Motion';
import { Screen } from '../components/Screen';
import { useGame } from '../game/GameContext';
import { Player } from '../game/types';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

const STEP_HEIGHTS = [scaledPixels(260), scaledPixels(190), scaledPixels(140)];
const MEDALS = ['🥇', '🥈', '🥉'];
// Third place rises first, the winner last.
const RISE_DELAY = [900, 500, 150];

interface Props {
  onPlayAgain: () => void;
}

export default function PodiumScreen({ onPlayAgain }: Props) {
  const { state, t } = useGame();
  useBackHandler(onPlayAgain);
  const ranked = [...state.players].sort((a, b) => b.score - a.score);
  // Podium order on screen: 2nd, 1st, 3rd.
  const podium = [ranked[1], ranked[0], ranked[2]].map((player, i) => ({ player, place: [1, 0, 2][i] }));
  const playerById = (id: string) => state.players.find((p) => p.id === id);

  return (
    <SpatialNavigationRoot>
      <Screen>
        <Text style={styles.title}>{t('podium.title')}</Text>

        <View style={styles.body}>
          <View style={styles.podium}>
            {podium.map(({ player, place }) =>
              player ? (
                <FadeIn key={player.id} delay={RISE_DELAY[place]} distance={scaledPixels(160)} duration={600}>
                  <Step player={player} place={place} />
                </FadeIn>
              ) : null,
            )}
          </View>

          <View style={styles.awards}>
            <FadeIn delay={1300}>
              <Text style={styles.awardsTitle}>{t('podium.awards')}</Text>
            </FadeIn>
            {state.awards === null ? (
              <Text style={styles.awardLine}>{t('podium.writing')}</Text>
            ) : (
              state.awards.map((award, i) => {
                const player = playerById(award.playerId);
                return (
                  <FadeIn key={award.playerId} delay={1500 + i * 250} distance={30}>
                    <View style={styles.award}>
                      <Text style={styles.awardTitle}>
                        {player?.avatar} {player?.name}: {award.title}
                      </Text>
                      <Text style={styles.awardLine}>{award.line}</Text>
                    </View>
                  </FadeIn>
                );
              })
            )}
          </View>
        </View>

        <FadeIn delay={1200}>
          <SpatialNavigationView direction="horizontal" style={styles.buttons}>
            <DefaultFocus>
              <FocusableButton label={t('podium.playAgain')} onSelect={onPlayAgain} />
            </DefaultFocus>
            {Platform.OS !== 'web' ? <FocusableButton label={t('podium.exit')} onSelect={() => BackHandler.exitApp()} /> : null}
          </SpatialNavigationView>
        </FadeIn>
        <Confetti delay={1000} />
        <Confetti delay={3200} pieces={40} />
      </Screen>
    </SpatialNavigationRoot>
  );
}

function Step({ player, place }: { player: Player; place: number }) {
  return (
    <View style={styles.step}>
      <PopIn delay={RISE_DELAY[place] + 350}>
        <Text style={styles.stepAvatar}>{player.avatar}</Text>
      </PopIn>
      <Text style={styles.stepName} numberOfLines={1}>
        {player.name}
      </Text>
      <CountUp value={player.score} duration={1400} style={styles.stepScore} />
      <View style={[styles.stepBlock, { height: STEP_HEIGHTS[place] }, place === 0 && styles.stepFirst]}>
        <Text style={styles.medal}>{MEDALS[place]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.focus, fontSize: scaledPixels(72), fontWeight: 'bold' },
  body: { flex: 1, flexDirection: 'row', gap: scaledPixels(80), marginTop: scaledPixels(30) },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: scaledPixels(24) },
  step: { alignItems: 'center', width: scaledPixels(240) },
  stepAvatar: { fontSize: scaledPixels(96) },
  stepName: { color: colors.text, fontSize: scaledPixels(34), fontWeight: 'bold' },
  stepScore: { color: colors.textSecondary, fontSize: scaledPixels(30), marginBottom: scaledPixels(12) },
  stepBlock: {
    width: '100%',
    backgroundColor: 'rgba(37, 45, 94, 0.95)',
    borderTopLeftRadius: scaledPixels(18),
    borderTopRightRadius: scaledPixels(18),
    alignItems: 'center',
    paddingTop: scaledPixels(16),
  },
  stepFirst: { backgroundColor: colors.selected },
  medal: { fontSize: scaledPixels(64) },
  awards: { flex: 1, gap: scaledPixels(20) },
  awardsTitle: { color: colors.text, fontSize: scaledPixels(40), fontWeight: 'bold' },
  award: {
    backgroundColor: 'rgba(26, 33, 72, 0.9)',
    borderRadius: scaledPixels(18),
    borderLeftWidth: scaledPixels(8),
    borderLeftColor: colors.focus,
    padding: scaledPixels(20),
  },
  awardTitle: { color: colors.focus, fontSize: scaledPixels(32), fontWeight: 'bold' },
  awardLine: { color: colors.textSecondary, fontSize: scaledPixels(28), marginTop: scaledPixels(4) },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: scaledPixels(32), marginTop: scaledPixels(24) },
});
