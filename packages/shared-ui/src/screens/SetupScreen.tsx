import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  DefaultFocus,
  SpatialNavigationNodeRef,
  SpatialNavigationRoot,
  SpatialNavigationView,
} from 'react-tv-space-navigation';
import { FocusableButton, OptionTile } from '../components/Focusable';
import { useGame } from '../game/GameContext';
import { Difficulty } from '../game/types';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

export const PRESET_TOPICS = [
  { label: 'Space', icon: '🚀' },
  { label: 'Animals', icon: '🦁' },
  { label: 'Oceans', icon: '🐠' },
  { label: 'Dinosaurs', icon: '🦖' },
  { label: 'Food', icon: '🍕' },
];

const DIFFICULTIES: Array<{ value: Difficulty; label: string; icon: string }> = [
  { value: 'easy', label: 'Easy', icon: '🙂' },
  { value: 'medium', label: 'Medium', icon: '🤔' },
  { value: 'hard', label: 'Hard', icon: '🔥' },
  { value: 'kids', label: 'Kids', icon: '🧸' },
];

interface Props {
  /** Where the D-pad starts: on the topics, or on difficulty right after a custom topic was entered. */
  initialFocus: 'topics' | 'difficulty';
  onCustomTopic: () => void;
  onCreateRoom: () => void;
}

export default function SetupScreen({ initialFocus, onCustomTopic, onCreateRoom }: Props) {
  const { state, setTopic, setDifficulty } = useGame();
  const difficultyRefs = useRef<Array<SpatialNavigationNodeRef | null>>([]);
  const createRef = useRef<SpatialNavigationNodeRef>(null);

  const isCustomTopic = !!state.topic && !PRESET_TOPICS.some((t) => t.label === state.topic);
  const selectedTopicIndex = isCustomTopic ? PRESET_TOPICS.length : Math.max(0, PRESET_TOPICS.findIndex((t) => t.label === state.topic));
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
        label={topic.label}
        icon={topic.icon}
        selected={state.topic === topic.label}
        onSelect={() => chooseTopic(topic.label)}
      />
    )),
    <OptionTile
      key="custom"
      label={isCustomTopic ? state.topic! : 'Custom…'}
      icon="✏️"
      selected={isCustomTopic}
      onSelect={onCustomTopic}
    />,
  ];
  const withDefaultFocus = (tile: React.ReactElement, index: number) =>
    initialFocus === 'topics' && index === selectedTopicIndex ? <DefaultFocus key={tile.key}>{tile}</DefaultFocus> : tile;

  return (
    <SpatialNavigationRoot>
      <View style={styles.container}>
        <Text style={styles.title}>Couch Quiz</Text>
        <Text style={styles.subtitle}>Pick a topic and a difficulty, then create a room.</Text>

        <SpatialNavigationView direction="vertical" style={styles.sections}>
          <SpatialNavigationView direction="vertical" alignInGrid style={styles.grid}>
            <SpatialNavigationView direction="horizontal" style={styles.row}>
              {topicTiles.slice(0, 3).map((tile, i) => withDefaultFocus(tile, i))}
            </SpatialNavigationView>
            <SpatialNavigationView direction="horizontal" style={styles.row}>
              {topicTiles.slice(3).map((tile, i) => withDefaultFocus(tile, i + 3))}
            </SpatialNavigationView>
          </SpatialNavigationView>

          <Text style={styles.sectionLabel}>Difficulty</Text>
          <SpatialNavigationView direction="horizontal" style={styles.row}>
            {DIFFICULTIES.map((d, i) => {
              const tile = (
                <OptionTile
                  key={d.value}
                  ref={(node) => {
                    difficultyRefs.current[i] = node;
                  }}
                  label={d.label}
                  icon={d.icon}
                  selected={state.difficulty === d.value}
                  onSelect={() => chooseDifficulty(d.value)}
                />
              );
              return initialFocus === 'difficulty' && i === selectedDifficultyIndex ? (
                <DefaultFocus key={d.value}>{tile}</DefaultFocus>
              ) : (
                tile
              );
            })}
          </SpatialNavigationView>

          <View style={styles.footer}>
            <FocusableButton
              ref={createRef}
              label={ready ? 'Create room ▶' : 'Pick a topic and difficulty'}
              disabled={!ready}
              onSelect={onCreateRoom}
            />
          </View>
        </SpatialNavigationView>
      </View>
    </SpatialNavigationRoot>
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
  subtitle: { color: colors.textSecondary, fontSize: scaledPixels(30), marginBottom: scaledPixels(30) },
  sections: { gap: scaledPixels(24) },
  grid: { gap: scaledPixels(24) },
  row: { flexDirection: 'row', gap: scaledPixels(28) },
  sectionLabel: { color: colors.textSecondary, fontSize: scaledPixels(30), fontWeight: 'bold', marginTop: scaledPixels(10) },
  footer: { alignItems: 'flex-start', marginTop: scaledPixels(16) },
});
