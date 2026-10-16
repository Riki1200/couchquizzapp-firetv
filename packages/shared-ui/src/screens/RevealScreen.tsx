import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { CountdownButton } from '../components/Focusable';
import { AnswerGrid, HostBubble, MiniAvatar } from '../components/GamePieces';
import { FadeIn } from '../components/Motion';
import { Leaderboard, TeamScores } from '../components/Leaderboard';
import { Screen } from '../components/Screen';
import { useGame } from '../game/GameContext';
import { TextKey } from '../game/types';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

/** The reveal moves on by itself after this long (the host can press Next earlier). */
const AUTO_NEXT_MS = 8000;
const AUTO_NEXT_KIDS_MS = 12000;

interface Props {
  navActive: boolean;
  onNext: () => void;
  onBack: (() => void) | null;
}

export default function RevealScreen({ navActive, onNext, onBack }: Props) {
  const { state, t } = useGame();
  const { questions, questionIndex, players, results } = state;
  const question = questions[questionIndex];
  const isLast = questionIndex === questions.length - 1;
  const autoNextMs = state.difficulty === 'kids' ? AUTO_NEXT_KIDS_MS : AUTO_NEXT_MS;

  useBackHandler(onBack);

  if (!question) return null;

  return (
    <SpatialNavigationRoot isActive={navActive}>
      <Screen style={styles.screen}>
        <Text style={styles.counter}>{t('question.counter', { index: questionIndex + 1, total: questions.length })}</Text>
        <Text style={styles.question}>{question.text}</Text>
        <AnswerGrid choices={question.choices} correctIndex={question.correctIndex} />

        <View style={styles.bubble}>
          <HostBubble text={question.quip} />
        </View>

        <View style={styles.footer}>
          <View style={styles.players}>
            {results === null ? (
              <Text style={styles.counting}>{t('reveal.counting')}</Text>
            ) : (
              players.map((p) => {
                const result = results.find((r) => r.playerId === p.id);
                return (
                  <MiniAvatar
                    key={p.id}
                    player={p}
                    streak={result?.streak}
                    badge={result?.correct ? `+${result.points}` : '✗'}
                    badgeColor={result?.correct ? colors.success : colors.error}
                  />
                );
              })
            )}
          </View>

          <View style={styles.side}>
            {results !== null ? (
              <FadeIn delay={400} style={styles.standings}>
                <Text style={styles.standingsTitle}>{t('reveal.standings')}</Text>
                {players.some((p) => p.team !== null) ? (
                  <TeamScores players={players} label={(team) => t(`team.${team}` as TextKey)} />
                ) : null}
                <Leaderboard players={players} results={results} />
              </FadeIn>
            ) : null}
            <DefaultFocus>
              <CountdownButton
                label={isLast ? t('reveal.results') : t('reveal.next')}
                durationMs={autoNextMs}
                running={navActive && results !== null}
                onSelect={() => results !== null && onNext()}
              />
            </DefaultFocus>
          </View>
        </View>
      </Screen>
    </SpatialNavigationRoot>
  );
}

const styles = StyleSheet.create({
  screen: { paddingVertical: scaledPixels(48) },
  counter: { color: colors.textSecondary, fontSize: scaledPixels(32), fontWeight: 'bold' },
  question: { color: colors.text, fontSize: scaledPixels(48), fontWeight: 'bold', marginVertical: scaledPixels(24) },
  bubble: { marginTop: scaledPixels(28) },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' },
  players: { flexDirection: 'row', gap: scaledPixels(12), flex: 1 },
  counting: { color: colors.textTertiary, fontSize: scaledPixels(32) },
  side: { alignItems: 'flex-end', gap: scaledPixels(16) },
  standings: { alignItems: 'flex-start' },
  standingsTitle: { color: colors.textTertiary, fontSize: scaledPixels(24), fontWeight: 'bold', marginBottom: scaledPixels(8) },
});
