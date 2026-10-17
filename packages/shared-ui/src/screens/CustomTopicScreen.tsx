import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput } from 'react-native';
import {
  DefaultFocus,
  SpatialNavigationFocusableView,
  SpatialNavigationRoot,
  SpatialNavigationView,
} from 'react-tv-space-navigation';
import { FocusableButton } from '../components/Focusable';
import { FadeIn } from '../components/Motion';
import { Screen } from '../components/Screen';
import { useGame } from '../game/GameContext';
import { MAX_TOPIC_LENGTH } from '../game/types';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

interface Props {
  initialTopic: string;
  onDone: (topic: string) => void;
  onCancel: () => void;
}

export default function CustomTopicScreen({ initialTopic, onDone, onCancel }: Props) {
  const { t, topicIdeas } = useGame();
  const [topic, setTopic] = useState(initialTopic);
  // "Surprise me": topic ideas from the AI host, picked with the D-pad (no typing).
  const [ideas, setIdeas] = useState<string[] | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  // The current ideas (and "More ideas") stay on screen while new ones load, so the D-pad focus isn't lost.
  const loadIdeas = () => {
    setLoadingIdeas(true);
    topicIdeas()
      .then(setIdeas)
      .catch(() => setIdeas((current) => current ?? []))
      .finally(() => setLoadingIdeas(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadIdeas, []);
  const inputRef = useRef<TextInput>(null);
  const trimmed = topic.trim();
  const submit = () => trimmed && onDone(trimmed);

  useBackHandler(onCancel);

  // Open the on-screen keyboard right away; that's why the host came here.
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SpatialNavigationRoot>
      <Screen style={styles.screen}>
        <Text style={styles.title}>{t('custom.title')}</Text>
        <Text style={styles.hint}>{t('custom.hint')}</Text>

        <SpatialNavigationView direction="vertical" style={styles.content}>
          <FadeIn delay={120}>
            <DefaultFocus>
              <SpatialNavigationFocusableView onSelect={() => inputRef.current?.focus()}>
                {({ isFocused }) => (
                  <TextInput
                    ref={inputRef}
                    value={topic}
                    onChangeText={setTopic}
                    onSubmitEditing={submit}
                    maxLength={MAX_TOPIC_LENGTH}
                    placeholder={t('custom.placeholder')}
                    placeholderTextColor={colors.textTertiary}
                    returnKeyType="done"
                    style={[styles.input, isFocused && styles.inputFocused]}
                  />
                )}
              </SpatialNavigationFocusableView>
            </DefaultFocus>
          </FadeIn>

          <FadeIn delay={220}>
            <SpatialNavigationView direction="horizontal" style={styles.buttons}>
              <FocusableButton label={t('custom.use')} disabled={!trimmed} onSelect={submit} />
              <FocusableButton label={t('common.cancel')} onSelect={onCancel} />
            </SpatialNavigationView>
          </FadeIn>

          <FadeIn delay={320}>
            <Text style={styles.ideasLabel}>{ideas === null || loadingIdeas ? t('custom.loadingIdeas') : t('custom.ideas')}</Text>
            <SpatialNavigationView direction="horizontal" style={styles.buttons}>
              {(ideas ?? []).map((idea) => (
                <FocusableButton key={idea} label={`✨ ${idea}`} onSelect={() => onDone(idea)} />
              ))}
              {ideas !== null ? <FocusableButton label={t('custom.moreIdeas')} onSelect={loadIdeas} /> : null}
            </SpatialNavigationView>
          </FadeIn>
        </SpatialNavigationView>

        {Platform.OS !== 'web' ? (
          // On TV keyboards Select types the highlighted key, so explain how to get back to the buttons.
          <FadeIn delay={600}>
            <Text style={styles.keyboardHint}>{t('custom.keyboardHint')}</Text>
          </FadeIn>
        ) : null}
      </Screen>
    </SpatialNavigationRoot>
  );
}

const styles = StyleSheet.create({
  screen: { paddingVertical: scaledPixels(100) },
  title: { color: colors.text, fontSize: scaledPixels(64), fontWeight: 'bold' },
  hint: { color: colors.textSecondary, fontSize: scaledPixels(30), marginTop: scaledPixels(12) },
  content: { marginTop: scaledPixels(60), gap: scaledPixels(48) },
  input: {
    color: colors.text,
    backgroundColor: 'rgba(26, 33, 72, 0.9)',
    fontSize: scaledPixels(44),
    paddingVertical: scaledPixels(24),
    paddingHorizontal: scaledPixels(32),
    borderRadius: scaledPixels(18),
    borderWidth: scaledPixels(5),
    borderColor: colors.border,
  },
  inputFocused: { borderColor: colors.focus },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: scaledPixels(32) },
  ideasLabel: { color: colors.textSecondary, fontSize: scaledPixels(30), fontWeight: 'bold', marginBottom: scaledPixels(16) },
  keyboardHint: { color: colors.focus, fontSize: scaledPixels(30), marginTop: scaledPixels(48) },
});
