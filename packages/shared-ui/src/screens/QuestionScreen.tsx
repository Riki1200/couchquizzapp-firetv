import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { playSound } from '../audio/sounds';
import { FocusableButton } from '../components/Focusable';
import { AnswerGrid, MiniAvatar } from '../components/GamePieces';
import { CountdownBar, FadeIn, usePulse } from '../components/Motion';
import { Screen } from '../components/Screen';
import { useGame } from '../game/GameContext';
import { TextKey, timeLimitMs } from '../game/types';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';
import { PRESET_TOPICS } from './SetupScreen';

const ALL_ANSWERED_PAUSE_MS = 800;

interface Props {
  navActive: boolean;
  onReveal: () => void;
  /** null while the quit dialog is open, so Back is handled by the dialog. */
  onBack: (() => void) | null;
}

export default function QuestionScreen({ navActive, onReveal, onBack }: Props) {
  const { state, t } = useGame();
  const { questions, questionIndex, players, answeredIds, difficulty, topic } = state;
  const question = questions[questionIndex];
  const limit = timeLimitMs(difficulty ?? 'easy');
  const [timeLeft, setTimeLeft] = useState(limit);
  const revealedRef = useRef(false);
  const topicLabel = PRESET_TOPICS.some((preset) => preset.label === topic) ? t(`topic.${topic}` as TextKey) : topic;

  useBackHandler(onBack);

  const revealOnce = () => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    onReveal();
  };

  // Seconds counter (the bar itself animates on its own, see CountdownBar).
  useEffect(() => {
    if (limit === null) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const left = Math.max(0, limit - (Date.now() - startedAt));
      setTimeLeft(left);
      if (left === 0 && !revealedRef.current) {
        playSound('timesup');
        revealOnce();
      }
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  // Everyone who is connected has answered → reveal after a short pause.
  const connected = players.filter((p) => p.connected);
  const allAnswered = connected.length > 0 && connected.every((p) => answeredIds.includes(p.id));
  useEffect(() => {
    if (!allAnswered) return;
    const timer = setTimeout(revealOnce, ALL_ANSWERED_PAUSE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswered]);

  const seconds = timeLeft === null ? null : Math.ceil(timeLeft / 1000);
  const urgent = seconds !== null && seconds <= 5;
  const timerScale = usePulse(seconds, urgent);
  // Tick during the last five seconds ("time's up" plays in the countdown above).
  useEffect(() => {
    if (seconds !== null && seconds >= 1 && seconds <= 5 && !revealedRef.current) playSound('tick');
  }, [seconds]);

  if (!question) return null;

  return (
    <SpatialNavigationRoot isActive={navActive}>
      <Screen style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.counter}>
            {t('question.counter', { index: questionIndex + 1, total: questions.length })} · {topicLabel}
          </Text>
          {seconds === null ? (
            <Text style={styles.kids}>{t('question.noTimer')}</Text>
          ) : (
            <Animated.View style={[styles.timer, urgent && styles.timerUrgent, { transform: [{ scale: timerScale }] }]}>
              <Text style={styles.timerText}>{seconds}</Text>
            </Animated.View>
          )}
        </View>

        {limit !== null ? (
          <CountdownBar durationMs={limit} style={styles.barTrack} fillStyle={[styles.bar, urgent && styles.barUrgent]} />
        ) : null}

        <FadeIn delay={60} distance={18}>
          <Text style={styles.question}>{question.text}</Text>
        </FadeIn>
        <AnswerGrid choices={question.choices} />

        <View style={styles.footer}>
          <View style={styles.players}>
            {players.map((p) => (
              <MiniAvatar key={p.id} player={p} badge={answeredIds.includes(p.id) ? t('question.locked') : '…'} />
            ))}
          </View>
          <DefaultFocus>
            <FocusableButton label={t('question.revealNow')} onSelect={revealOnce} />
          </DefaultFocus>
        </View>
      </Screen>
    </SpatialNavigationRoot>
  );
}

const styles = StyleSheet.create({
  screen: { paddingVertical: scaledPixels(48) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { color: colors.textSecondary, fontSize: scaledPixels(32), fontWeight: 'bold' },
  kids: { color: colors.focus, fontSize: scaledPixels(36), fontWeight: 'bold' },
  timer: {
    width: scaledPixels(110),
    height: scaledPixels(110),
    borderRadius: scaledPixels(55),
    backgroundColor: colors.selected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerUrgent: { backgroundColor: colors.error },
  timerText: { color: colors.text, fontSize: scaledPixels(52), fontWeight: 'bold' },
  barTrack: {
    height: scaledPixels(14),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: scaledPixels(7),
    marginTop: scaledPixels(20),
  },
  bar: { backgroundColor: colors.focus, borderRadius: scaledPixels(7) },
  barUrgent: { backgroundColor: colors.error },
  question: {
    color: colors.text,
    fontSize: scaledPixels(60),
    fontWeight: 'bold',
    marginVertical: scaledPixels(40),
    minHeight: scaledPixels(150),
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' },
  players: { flexDirection: 'row', gap: scaledPixels(12), flex: 1 },
});
