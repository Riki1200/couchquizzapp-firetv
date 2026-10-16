import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  DefaultFocus,
  SpatialNavigationNodeRef,
  SpatialNavigationRoot,
  SpatialNavigationView,
} from 'react-tv-space-navigation';
import { FocusableButton, OptionTile } from '../components/Focusable';
import { FadeIn } from '../components/Motion';
import { Screen } from '../components/Screen';
import { useGame } from '../game/GameContext';
import { Difficulty, TextKey } from '../game/types';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

/** Preset topics; `label` is the topic key used by the question bank (shown translated). */
export const PRESET_TOPICS = [
  { label: 'Space', icon: '🚀' },
  { label: 'Animals', icon: '🦁' },
  { label: 'Oceans', icon: '🐠' },
  { label: 'Dinosaurs', icon: '🦖' },
  { label: 'Food', icon: '🍕' },
];

const DIFFICULTIES: Array<{ value: Difficulty; icon: string }> = [
  { value: 'easy', icon: '🙂' },
  { value: 'medium', icon: '🤔' },
  { value: 'hard', icon: '🔥' },
  { value: 'kids', icon: '🧸' },
];

interface Props {
  /** Where the D-pad starts: on the topics, or on difficulty right after a custom topic was entered. */
  initialFocus: 'topics' | 'difficulty';
  onCustomTopic: () => void;
  onCreateRoom: () => void;
  onSettings: () => void;
}

export default function SetupScreen({ initialFocus, onCustomTopic, onCreateRoom, onSettings }: Props) {
  const { state, setTopic, setDifficulty, t } = useGame();
  const difficultyRefs = useRef<Array<SpatialNavigationNodeRef | null>>([]);
  const createRef = useRef<SpatialNavigationNodeRef>(null);

  const isCustomTopic = !!state.topic && !PRESET_TOPICS.some((topic) => topic.label === state.topic);
  const selectedTopicIndex = isCustomTopic
    ? PRESET_TOPICS.length
    : Math.max(0, PRESET_TOPICS.findIndex((topic) => topic.label === state.topic));
  const selectedDifficultyIndex = Math.max(0, DIFFICULTIES.findIndex((d) => d.value === state.difficulty));
  const ready = !!state.topic && !!state.difficulty;

  // Selecting moves focus down to the next step: topic → difficulty → Create room.
  const chooseTopic = (topic: string) => {
    setTopic(topic);
    difficultyRefs.current[selectedDifficultyIndex]?.focus();
  };
  const chooseDifficulty = (difficulty: Difficulty) => {
    setDifficulty(difficulty);
    createRef.current?.focus();
  };

  const topicTiles = [
    ...PRESET_TOPICS.map((topic) => (
      <OptionTile
        key={topic.label}
        label={t(`topic.${topic.label}` as TextKey)}
        icon={topic.icon}
        selected={state.topic === topic.label}
        onSelect={() => chooseTopic(topic.label)}
      />
    )),
    <OptionTile
      key="custom"
      label={isCustomTopic ? state.topic! : t('setup.custom')}
      icon="✏️"
      selected={isCustomTopic}
      onSelect={onCustomTopic}
    />,
  ];
  const withDefaultFocus = (tile: React.ReactElement, index: number) =>
    initialFocus === 'topics' && index === selectedTopicIndex ? <DefaultFocus key={tile.key}>{tile}</DefaultFocus> : tile;
  const tileRow = (tiles: React.ReactElement[], offset: number) => (
    <SpatialNavigationView direction="horizontal" style={styles.row}>
      {tiles.map((tile, i) => (
        <FadeIn key={tile.key} delay={120 + (offset + i) * 60}>
          {withDefaultFocus(tile, offset + i)}
        </FadeIn>
      ))}
    </SpatialNavigationView>
  );

  return (
    <SpatialNavigationRoot>
      <Screen>
        <SpatialNavigationView direction="vertical" style={styles.sections}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Couch Quiz</Text>
              <Text style={styles.subtitle}>{t('setup.subtitle')}</Text>
            </View>
            <FocusableButton label={t('setup.settings')} onSelect={onSettings} />
          </View>

          <SpatialNavigationView direction="vertical" alignInGrid style={styles.grid}>
            {tileRow(topicTiles.slice(0, 3), 0)}
            {tileRow(topicTiles.slice(3), 3)}
          </SpatialNavigationView>

          <Text style={styles.sectionLabel}>{t('setup.difficulty')}</Text>
          <SpatialNavigationView direction="horizontal" style={styles.row}>
            {DIFFICULTIES.map((d, i) => {
              const tile = (
                <OptionTile
                  ref={(node) => {
                    difficultyRefs.current[i] = node;
                  }}
                  label={t(`difficulty.${d.value}` as TextKey)}
                  icon={d.icon}
                  selected={state.difficulty === d.value}
                  onSelect={() => chooseDifficulty(d.value)}
                />
              );
              return (
                <FadeIn key={d.value} delay={480 + i * 60}>
                  {initialFocus === 'difficulty' && i === selectedDifficultyIndex ? <DefaultFocus>{tile}</DefaultFocus> : tile}
                </FadeIn>
              );
            })}
          </SpatialNavigationView>

          <FadeIn delay={720} style={styles.footer}>
            <FocusableButton
              ref={createRef}
              label={ready ? t('setup.create') : t('setup.pick')}
              disabled={!ready}
              onSelect={onCreateRoom}
            />
          </FadeIn>
        </SpatialNavigationView>
      </Screen>
    </SpatialNavigationRoot>
  );
}

const styles = StyleSheet.create({
  sections: { gap: scaledPixels(22) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: colors.focus, fontSize: scaledPixels(72), fontWeight: 'bold' },
  subtitle: { color: colors.textSecondary, fontSize: scaledPixels(30) },
  grid: { gap: scaledPixels(24) },
  row: { flexDirection: 'row', gap: scaledPixels(28) },
  sectionLabel: { color: colors.textSecondary, fontSize: scaledPixels(30), fontWeight: 'bold', marginTop: scaledPixels(6) },
  footer: { alignItems: 'flex-start', marginTop: scaledPixels(10) },
});
