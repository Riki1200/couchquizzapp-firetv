import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { FocusableButton } from '../components/Focusable';
import { AnswerGrid, HostBubble, MiniAvatar } from '../components/GamePieces';
import { useGame } from '../game/GameContext';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

interface Props {
  navActive: boolean;
  onNext: () => void;
  onBack: (() => void) | null;
}

export default function RevealScreen({ navActive, onNext, onBack }: Props) {
  const { state } = useGame();
  const { questions, questionIndex, players, results } = state;
  const question = questions[questionIndex];
  const isLast = questionIndex === questions.length - 1;

  useBackHandler(onBack);

  if (!question) return null;
  const standings = [...players].sort((a, b) => b.score - a.score).slice(0, 3);

  return (
    <SpatialNavigationRoot isActive={navActive}>
      <View style={styles.container}>
        <Text style={styles.counter}>
          Question {questionIndex + 1} / {questions.length}
        </Text>
        <Text style={styles.question}>{question.text}</Text>
        <AnswerGrid choices={question.choices} correctIndex={question.correctIndex} />

        <View style={styles.bubble}>
          <HostBubble text={question.quip} />
        </View>

        <View style={styles.footer}>
          <View style={styles.players}>
            {results === null ? (
              <Text style={styles.counting}>Counting answers…</Text>
            ) : (
              players.map((p) => {
                const result = results.find((r) => r.playerId === p.id);
                return (
                  <MiniAvatar
                    key={p.id}
                    player={p}
                    badge={result?.correct ? `+${result.points}` : '✗'}
                    badgeColor={result?.correct ? colors.success : colors.error}
                  />
                );
              })
            )}
          </View>

          <View style={styles.side}>
            <View style={styles.standings}>
              {standings.map((p, i) => (
                <Text key={p.id} style={styles.standing}>
                  {i + 1}. {p.avatar} {p.name} — {p.score}
                </Text>
              ))}
            </View>
            <DefaultFocus>
              <FocusableButton
                label={isLast ? 'See results ▶' : 'Next question ▶'}
                disabled={results === null}
                onSelect={onNext}
              />
            </DefaultFocus>
          </View>
        </View>
      </View>
    </SpatialNavigationRoot>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: scaledPixels(120),
    paddingVertical: scaledPixels(50),
  },
  counter: { color: colors.textSecondary, fontSize: scaledPixels(32), fontWeight: 'bold' },
  question: { color: colors.text, fontSize: scaledPixels(48), fontWeight: 'bold', marginVertical: scaledPixels(24) },
  bubble: { marginTop: scaledPixels(28) },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' },
  players: { flexDirection: 'row', gap: scaledPixels(12), flex: 1 },
  counting: { color: colors.textTertiary, fontSize: scaledPixels(32) },
  side: { alignItems: 'flex-end', gap: scaledPixels(16) },
  standings: { alignItems: 'flex-end' },
  standing: { color: colors.textSecondary, fontSize: scaledPixels(28), fontWeight: 'bold' },
});
