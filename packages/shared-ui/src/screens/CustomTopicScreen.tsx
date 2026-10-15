import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  DefaultFocus,
  SpatialNavigationFocusableView,
  SpatialNavigationRoot,
  SpatialNavigationView,
} from 'react-tv-space-navigation';
import { FocusableButton } from '../components/Focusable';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

const MAX_TOPIC_LENGTH = 60;

interface Props {
  initialTopic: string;
  onDone: (topic: string) => void;
  onCancel: () => void;
}

export default function CustomTopicScreen({ initialTopic, onDone, onCancel }: Props) {
  const [topic, setTopic] = useState(initialTopic);
  const inputRef = useRef<TextInput>(null);
  const trimmed = topic.trim();
  const submit = () => trimmed && onDone(trimmed);

  useBackHandler(onCancel);

  // Open the on-screen keyboard right away; that's why the host came here.
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SpatialNavigationRoot>
      <View style={styles.container}>
        <Text style={styles.title}>Your own topic</Text>
        <Text style={styles.hint}>Anything goes: “our family trip to the beach”, “90s cartoons”, “Grandma’s garden”…</Text>

        <SpatialNavigationView direction="vertical" style={styles.content}>
          <DefaultFocus>
            <SpatialNavigationFocusableView onSelect={() => inputRef.current?.focus()}>
              {({ isFocused }) => (
                <TextInput
                  ref={inputRef}
                  value={topic}
                  onChangeText={setTopic}
                  onSubmitEditing={submit}
                  maxLength={MAX_TOPIC_LENGTH}
                  placeholder="Type a topic"
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="done"
                  style={[styles.input, isFocused && styles.inputFocused]}
                />
              )}
            </SpatialNavigationFocusableView>
          </DefaultFocus>

          <SpatialNavigationView direction="horizontal" style={styles.buttons}>
            <FocusableButton label="Cancel" onSelect={onCancel} />
            <FocusableButton label="Use this topic ▶" disabled={!trimmed} onSelect={submit} />
          </SpatialNavigationView>
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
    paddingVertical: scaledPixels(100),
  },
  title: { color: colors.text, fontSize: scaledPixels(64), fontWeight: 'bold' },
  hint: { color: colors.textSecondary, fontSize: scaledPixels(30), marginTop: scaledPixels(12) },
  content: { marginTop: scaledPixels(60), gap: scaledPixels(48) },
  input: {
    color: colors.text,
    backgroundColor: colors.card,
    fontSize: scaledPixels(44),
    paddingVertical: scaledPixels(24),
    paddingHorizontal: scaledPixels(32),
    borderRadius: scaledPixels(16),
    borderWidth: scaledPixels(5),
    borderColor: colors.border,
  },
  inputFocused: { borderColor: colors.focus },
  buttons: { flexDirection: 'row', gap: scaledPixels(32) },
});
