import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { FocusableButton } from '../components/Focusable';
import { playSound } from '../audio/sounds';
import { AnswerGrid, MiniAvatar } from '../components/GamePieces';
import { useGame } from '../game/GameContext';
import { timeLimitMs } from '../game/types';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

const ALL_ANSWERED_PAUSE_MS = 800;

interface Props {
  navActive: boolean;
  onReveal: () => void;
  /** null while the quit dialog is open, so Back is handled by the dialog. */
  onBack: (() => void) | null;
}

export default function QuestionScreen({ navActive, onReveal, onBack }: Props) {
  const { state } = useGame();
  const { questions, questionIndex, players, answeredIds, difficulty, topic } = state;
  const question = questions[questionIndex];
  const limit = timeLimitMs(difficulty ?? 'easy');
  const [timeLeft, setTimeLeft] = useState(limit);
  const revealedRef = useRef(false);

  useBackHandler(onBack);

  const revealOnce = () => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    onReveal();
  };

  // Countdown (not in kids mode).
  useEffect(() => {
    if (limit === null) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const left = Math.max(0, limit - (Date.now() - startedAt));
      setTimeLeft(left);
      if (left === 0) revealOnce();
    }, 250);
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
  // Tick during the last five seconds, buzz when time runs out.
  useEffect(() => {
    if (seconds === null || seconds > 5 || revealedRef.current) return;
    playSound(seconds === 0 ? 'timesup' : 'tick');
  }, [seconds]);

  if (!question) return null;

  return (
    <SpatialNavigationRoot isActive={navActive}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.counter}>
            Question {questionIndex + 1} / {questions.length} · {topic}
          </Text>
          {seconds === null ? (
            <Text style={styles.kids}>🧸 Take your time!</Text>
          ) : (
            <View style={[styles.timer, seconds <= 5 && styles.timerUrgent]}>
              <Text style={styles.timerText}>{seconds}</Text>
            </View>
          )}
        </View>

        {limit !== null && timeLeft !== null ? (
          <View style={styles.barTrack}>
            <View style={[styles.bar, { width: `${(timeLeft / limit) * 100}%` }]} />
          </View>
        ) : null}

        <Text style={styles.question}>{question.text}</Text>
        <AnswerGrid choices={question.choices} />

        <View style={styles.footer}>
          <View style={styles.players}>
            {players.map((p) => (
              <MiniAvatar key={p.id} player={p} badge={answeredIds.includes(p.id) ? '✓ locked in' : '…'} />
            ))}
          </View>
          <DefaultFocus>
            <FocusableButton label="Reveal now ▶" onSelect={revealOnce} />
          </DefaultFocus>
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
    height: scaledPixels(12),
    backgroundColor: colors.card,
    borderRadius: scaledPixels(6),
    marginTop: scaledPixels(20),
    overflow: 'hidden',
  },
  bar: { height: '100%', backgroundColor: colors.focus },
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
