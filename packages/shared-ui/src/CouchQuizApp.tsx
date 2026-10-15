import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GameProvider, useGame } from './game/GameContext';
import { useBackHandler } from './hooks/useBackHandler';
import { scaledPixels } from './hooks/useScale';
import CustomTopicScreen from './screens/CustomTopicScreen';
import LobbyScreen from './screens/LobbyScreen';
import SetupScreen, { PRESET_TOPICS } from './screens/SetupScreen';
import { colors } from './theme/colors';

// The game is a short linear flow, so a screen switch is simpler than a navigation stack
// and behaves the same on Vega, Android TV and web.
type Screen = 'setup' | 'customTopic' | 'lobby' | 'game';

function Screens() {
  const { state, setTopic, openLobby } = useGame();
  const [screen, setScreen] = useState<Screen>('setup');
  const [setupFocus, setSetupFocus] = useState<'topics' | 'difficulty'>('topics');

  // Each screen except Setup registers its own Back handler; on Setup the system handles Back (exits the app).
  switch (screen) {
    case 'setup':
      return (
        <SetupScreen
          initialFocus={setupFocus}
          onCustomTopic={() => setScreen('customTopic')}
          onCreateRoom={() => {
            openLobby();
            setScreen('lobby');
          }}
        />
      );
    case 'customTopic':
      return (
        <CustomTopicScreen
          initialTopic={PRESET_TOPICS.some((t) => t.label === state.topic) ? '' : (state.topic ?? '')}
          onDone={(topic) => {
            setTopic(topic);
            setSetupFocus('difficulty');
            setScreen('setup');
          }}
          onCancel={() => {
            setSetupFocus('topics');
            setScreen('setup');
          }}
        />
      );
    case 'lobby':
      return (
        <LobbyScreen
          onChangeTopic={() => {
            setSetupFocus('topics');
            setScreen('setup');
          }}
          onRetryGeneration={openLobby}
          onStart={() => setScreen('game')}
        />
      );
    case 'game':
      return <GamePlaceholder onBack={() => setScreen('lobby')} />;
  }
}

// Replaced by the Question / Reveal / Podium screens on Day 3.
function GamePlaceholder({ onBack }: { onBack: () => void }) {
  useBackHandler(onBack);
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>Game screens arrive on Day 3. Press Back to return to the lobby.</Text>
    </View>
  );
}

export default function CouchQuizApp() {
  return (
    <GameProvider>
      <Screens />
    </GameProvider>
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: colors.text, fontSize: scaledPixels(36) },
});
