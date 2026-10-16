import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { ANSWER_STYLES, Player } from '../game/types';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';
import { FadeIn, PopIn, nativeDriver } from './Motion';

type AnswerState = 'normal' | 'correct' | 'dimmed';

/**
 * One of the four answers on the TV (not focusable — players answer on their phones).
 * On reveal the correct card bounces up and the others fade back.
 */
export function AnswerCard({ index, text, state = 'normal' }: { index: number; text: string; state?: AnswerState }) {
  const style = ANSWER_STYLES[index];
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: state === 'dimmed' ? 0.22 : 1, duration: 450, useNativeDriver: nativeDriver }).start();
    if (state === 'correct') {
      scale.setValue(0.92);
      Animated.spring(scale, { toValue: 1.04, friction: 4, tension: 120, useNativeDriver: nativeDriver }).start();
    } else {
      Animated.spring(scale, { toValue: 1, useNativeDriver: nativeDriver }).start();
    }
  }, [state, opacity, scale]);

  return (
    <Animated.View
      style={[
        styles.answer,
        { backgroundColor: style.color, opacity, transform: [{ scale }] },
        state === 'correct' && styles.correct,
      ]}
    >
      <View style={styles.letter}>
        <Text style={[styles.letterText, { color: style.color }]}>{style.letter}</Text>
      </View>
      <Text style={styles.answerText} numberOfLines={2}>
        {text}
      </Text>
      {state === 'correct' ? (
        <PopIn delay={150}>
          <Text style={styles.answerMark}>✓</Text>
        </PopIn>
      ) : null}
    </Animated.View>
  );
}

/** The four answers; they slide in one after another. */
export function AnswerGrid({ choices, correctIndex }: { choices: string[]; correctIndex?: number }) {
  const stateFor = (i: number): AnswerState =>
    correctIndex === undefined ? 'normal' : i === correctIndex ? 'correct' : 'dimmed';
  return (
    <View style={styles.grid}>
      {choices.map((choice, i) => (
        <FadeIn key={i} delay={correctIndex === undefined ? 120 + i * 90 : 0} duration={correctIndex === undefined ? 380 : 1}>
          <AnswerCard index={i} text={choice} state={stateFor(i)} />
        </FadeIn>
      ))}
    </View>
  );
}

/** The AI host's line, sliding in like a speech bubble. */
export function HostBubble({ text, delay = 350 }: { text: string; delay?: number }) {
  return (
    <FadeIn delay={delay} distance={30}>
      <View style={styles.bubble}>
        <Text style={styles.bubbleIcon}>🎙️</Text>
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
    </FadeIn>
  );
}

/** Small avatar with an optional badge (✓ answered, +points…) that pops in when it changes. */
export function MiniAvatar({ player, badge, badgeColor }: { player: Player; badge?: string; badgeColor?: string }) {
  return (
    <View style={[styles.mini, !player.connected && styles.disconnected]}>
      <View style={styles.miniCircle}>
        <Text style={styles.miniEmoji}>{player.avatar}</Text>
      </View>
      <Text style={styles.miniName} numberOfLines={1}>
        {player.name}
      </Text>
      {badge ? (
        <PopIn key={badge}>
          <Text style={[styles.miniBadge, badgeColor ? { color: badgeColor } : null]}>{badge}</Text>
        </PopIn>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: scaledPixels(24) },
  answer: {
    width: scaledPixels(828),
    height: scaledPixels(150),
    borderRadius: scaledPixels(22),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaledPixels(28),
    borderWidth: scaledPixels(6),
    borderColor: 'transparent',
  },
  correct: {
    borderColor: colors.text,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: scaledPixels(26),
    elevation: 12,
  },
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
    backgroundColor: 'rgba(37, 45, 94, 0.92)',
    borderRadius: scaledPixels(28),
    borderWidth: scaledPixels(3),
    borderColor: 'rgba(255, 210, 63, 0.35)',
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
