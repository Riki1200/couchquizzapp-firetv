import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ANSWER_STYLES, Player } from '../game/types';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

type AnswerState = 'normal' | 'correct' | 'dimmed';

/** One of the four answers on the TV (not focusable — players answer on their phones). */
export function AnswerCard({ index, text, state = 'normal' }: { index: number; text: string; state?: AnswerState }) {
  const style = ANSWER_STYLES[index];
  return (
    <View
      style={[
        styles.answer,
        { backgroundColor: style.color },
        state === 'dimmed' && styles.dimmed,
        state === 'correct' && styles.correct,
      ]}
    >
      <View style={styles.letter}>
        <Text style={[styles.letterText, { color: style.color }]}>{style.letter}</Text>
      </View>
      <Text style={styles.answerText} numberOfLines={2}>
        {text}
      </Text>
      {state === 'correct' ? <Text style={styles.answerMark}>✓</Text> : null}
    </View>
  );
}

export function AnswerGrid({ choices, correctIndex }: { choices: string[]; correctIndex?: number }) {
  const stateFor = (i: number): AnswerState =>
    correctIndex === undefined ? 'normal' : i === correctIndex ? 'correct' : 'dimmed';
  return (
    <View style={styles.grid}>
      {choices.map((choice, i) => (
        <AnswerCard key={i} index={i} text={choice} state={stateFor(i)} />
      ))}
    </View>
  );
}

/** The AI host's line. */
export function HostBubble({ text }: { text: string }) {
  return (
    <View style={styles.bubble}>
      <Text style={styles.bubbleIcon}>🎙️</Text>
      <Text style={styles.bubbleText}>{text}</Text>
    </View>
  );
}

/** Small avatar with an optional badge (✓ answered, +points…). */
export function MiniAvatar({ player, badge, badgeColor }: { player: Player; badge?: string; badgeColor?: string }) {
  return (
    <View style={[styles.mini, !player.connected && styles.disconnected]}>
      <View style={styles.miniCircle}>
        <Text style={styles.miniEmoji}>{player.avatar}</Text>
      </View>
      <Text style={styles.miniName} numberOfLines={1}>
        {player.name}
      </Text>
      {badge ? <Text style={[styles.miniBadge, badgeColor ? { color: badgeColor } : null]}>{badge}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: scaledPixels(24) },
  answer: {
    width: scaledPixels(828),
    height: scaledPixels(150),
    borderRadius: scaledPixels(20),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaledPixels(28),
    borderWidth: scaledPixels(6),
    borderColor: 'transparent',
  },
  dimmed: { opacity: 0.25 },
  correct: { borderColor: colors.text, transform: [{ scale: 1.03 }] },
  letter: {
    width: scaledPixels(80),
    height: scaledPixels(80),
    borderRadius: scaledPixels(40),
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scaledPixels(28),
  },
  letterText: { fontSize: scaledPixels(44), fontWeight: 'bold' },
  answerText: { flex: 1, color: colors.text, fontSize: scaledPixels(40), fontWeight: 'bold' },
  answerMark: { color: colors.text, fontSize: scaledPixels(64), fontWeight: 'bold', marginLeft: scaledPixels(16) },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardRaised,
    borderRadius: scaledPixels(24),
    paddingVertical: scaledPixels(24),
    paddingHorizontal: scaledPixels(32),
  },
  bubbleIcon: { fontSize: scaledPixels(56), marginRight: scaledPixels(24) },
  bubbleText: { flex: 1, color: colors.text, fontSize: scaledPixels(38), fontStyle: 'italic' },
  mini: { alignItems: 'center', width: scaledPixels(140) },
  disconnected: { opacity: 0.35 },
  miniCircle: {
    width: scaledPixels(88),
    height: scaledPixels(88),
    borderRadius: scaledPixels(44),
    backgroundColor: colors.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniEmoji: { fontSize: scaledPixels(48) },
  miniName: { color: colors.text, fontSize: scaledPixels(24), fontWeight: 'bold', marginTop: scaledPixels(6) },
  miniBadge: { color: colors.success, fontSize: scaledPixels(28), fontWeight: 'bold' },
});
