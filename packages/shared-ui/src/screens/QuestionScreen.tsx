import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { playSound } from '../audio/sounds';
import { FocusableButton } from '../components/Focusable';
import { AnswerGrid, MiniAvatar } from '../components/GamePieces';
import { CountdownBar, FadeIn, PopIn, usePulse } from '../components/Motion';
import { Screen } from '../components/Screen';
import { useGame } from '../game/GameContext';
import { TextKey, timeLimitMs } from '../game/types';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';
import { PRESET_TOPICS } from './SetupScreen';

/** How long the "Question 3" title shows before the question goes live on the phones. */
const INTRO_MS = 1400;
/** How long "Everyone answered!" / "Time's up!" shows before the reveal. */
const ENDING_MS = 1100;

type Stage = 'intro' | 'live' | 'allAnswered' | 'timesUp';

interface Props {
  navActive: boolean;
  /** Called when the intro ends: the phones get the question and the server starts timing. */
  onIntroDone: () => void;
  onReveal: () => void;
  /** null while the quit dialog is open, so Back is handled by the dialog. */
  onBack: (() => void) | null;
}

export default function QuestionScreen({ navActive, onIntroDone, onReveal, onBack }: Props) {
  const { state, t } = useGame();
  const { questions, questionIndex, players, answeredIds, difficulty, topic } = state;
  const question = questions[questionIndex];
  const limit = timeLimitMs(difficulty ?? 'easy');
  const [stage, setStageState] = useState<Stage>('intro');
  const stageRef = useRef<Stage>('intro');
  const setStage = (next: Stage) => {
    stageRef.current = next;
    setStageState(next);
  };
  const endingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (endingTimer.current) clearTimeout(endingTimer.current); // left the screen (e.g. quit)
  }, []);
  const [timeLeft, setTimeLeft] = useState(limit);
  const revealedRef = useRef(false);
  const topicLabel = PRESET_TOPICS.some((preset) => preset.label === topic) ? t(`topic.${topic}` as TextKey) : topic;

  useBackHandler(onBack);

  const revealOnce = () => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    onReveal();
  };
  /** Shows a short banner, then reveals (only once, and only while the question is live). */
  const endWith = (ending: 'allAnswered' | 'timesUp') => {
    if (stageRef.current !== 'live') return;
    setStage(ending);
    endingTimer.current = setTimeout(revealOnce, ENDING_MS);
  };

  // Intro → live.
  useEffect(() => {
    const timer = setTimeout(() => {
      setStage('live');
      onIntroDone();
    }, INTRO_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seconds counter while live (the bar itself animates on its own, see CountdownBar).
  useEffect(() => {
    if (stage !== 'live' || limit === null) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const left = Math.max(0, limit - (Date.now() - startedAt));
      setTimeLeft(left);
      if (left === 0) {
        playSound('timesup');
        endWith('timesUp');
      }
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage === 'live', limit]);

  // Everyone who is connected has answered → "Everyone answered!" → reveal.
  const connected = players.filter((p) => p.connected);
  const allAnswered = connected.length > 0 && connected.every((p) => answeredIds.includes(p.id));
  useEffect(() => {
    if (allAnswered && stage === 'live') endWith('allAnswered');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswered, stage]);

  const seconds = timeLeft === null ? null : Math.ceil(timeLeft / 1000);
  const urgent = stage === 'live' && seconds !== null && seconds <= 5;
  const timerScale = usePulse(seconds, urgent);
  // Tick during the last five seconds ("time's up" plays in the countdown above).
  useEffect(() => {
    if (stage === 'live' && seconds !== null && seconds >= 1 && seconds <= 5) playSound('tick');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  if (!question) return null;

  if (stage === 'intro') {
    return (
      <SpatialNavigationRoot isActive={navActive}>
        <Screen style={styles.intro}>
          <PopIn>
            <Text style={styles.introTitle}>{t('question.intro', { index: questionIndex + 1 })}</Text>
          </PopIn>
          <FadeIn delay={250}>
            <Text style={styles.introSub}>{t('question.introSub', { total: questions.length, topic: topicLabel ?? '' })}</Text>
          </FadeIn>
        </Screen>
      </SpatialNavigationRoot>
    );
  }

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
              <MiniAvatar key={p.id} player={p} answered={answeredIds.includes(p.id)} />
            ))}
          </View>
          <DefaultFocus>
            <FocusableButton label={t('question.revealNow')} onSelect={revealOnce} />
          </DefaultFocus>
        </View>

        {stage === 'allAnswered' || stage === 'timesUp' ? (
          <View pointerEvents="none" style={styles.endingOverlay}>
            <PopIn>
              <View style={[styles.endingCard, stage === 'timesUp' && styles.endingCardTimesUp]}>
                <Text style={styles.endingText}>{t(stage === 'timesUp' ? 'question.timesUp' : 'question.allAnswered')}</Text>
              </View>
            </PopIn>
          </View>
        ) : null}
      </Screen>
    </SpatialNavigationRoot>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', justifyContent: 'center' },
  introTitle: { color: colors.focus, fontSize: scaledPixels(150), fontWeight: 'bold' },
  introSub: { color: colors.textSecondary, fontSize: scaledPixels(44), fontWeight: 'bold', textAlign: 'center' },
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
  endingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endingCard: {
    backgroundColor: colors.success,
    borderRadius: scaledPixels(32),
    paddingVertical: scaledPixels(36),
    paddingHorizontal: scaledPixels(72),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaledPixels(10) },
    shadowOpacity: 0.5,
    shadowRadius: scaledPixels(30),
    elevation: 16,
  },
  endingCardTimesUp: { backgroundColor: colors.error },
  endingText: { color: colors.text, fontSize: scaledPixels(72), fontWeight: 'bold' },
});
