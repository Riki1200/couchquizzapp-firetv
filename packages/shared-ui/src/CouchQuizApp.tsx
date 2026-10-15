import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { QuitDialog } from './components/QuitDialog';
import { GameProvider, useGame } from './game/GameContext';
import { scaledPixels } from './hooks/useScale';
import CustomTopicScreen from './screens/CustomTopicScreen';
import LobbyScreen from './screens/LobbyScreen';
import PodiumScreen from './screens/PodiumScreen';
import QuestionScreen from './screens/QuestionScreen';
import RevealScreen from './screens/RevealScreen';
import SetupScreen, { PRESET_TOPICS } from './screens/SetupScreen';
import { colors } from './theme/colors';

// The game is a short linear flow, so a screen switch is simpler than a navigation stack
// and behaves the same on Vega, Android TV and web.
type Screen = 'setup' | 'customTopic' | 'lobby' | 'question' | 'reveal' | 'podium';

function Screens() {
  const game = useGame();
  const { state } = game;
  const [screen, setScreen] = useState<Screen>('setup');
  const [setupFocus, setSetupFocus] = useState<'topics' | 'difficulty'>('topics');
  const [quitOpen, setQuitOpen] = useState(false);

  const goToSetup = () => {
    setQuitOpen(false);
    setSetupFocus('topics');
    setScreen('setup');
  };

  // Each screen except Setup handles Back itself; on Setup the system handles Back (exits the app).
  switch (screen) {
    case 'setup':
      return (
        <SetupScreen
          initialFocus={setupFocus}
          onCustomTopic={() => setScreen('customTopic')}
          onCreateRoom={() => {
            game.openLobby();
            setScreen('lobby');
          }}
        />
      );
    case 'customTopic':
      return (
        <CustomTopicScreen
          initialTopic={PRESET_TOPICS.some((t) => t.label === state.topic) ? '' : (state.topic ?? '')}
          onDone={(topic) => {
            game.setTopic(topic);
            setSetupFocus('difficulty');
            setScreen('setup');
          }}
          onCancel={goToSetup}
        />
      );
    case 'lobby':
      return (
        <LobbyScreen
          onChangeTopic={goToSetup}
          onRetryGeneration={game.openLobby}
          onStart={() => {
            game.startQuestion(0);
            setScreen('question');
          }}
        />
      );
    case 'question':
    case 'reveal':
      return (
        <View style={styles.fill}>
          {screen === 'question' ? (
            <QuestionScreen
              navActive={!quitOpen}
              onBack={quitOpen ? null : () => setQuitOpen(true)}
              onReveal={() => {
                game.reveal();
                setScreen('reveal');
              }}
            />
          ) : (
            <RevealScreen
              navActive={!quitOpen}
              onBack={quitOpen ? null : () => setQuitOpen(true)}
              onNext={() => {
                if (state.questionIndex + 1 < state.questions.length) {
                  game.startQuestion(state.questionIndex + 1);
                  setScreen('question');
                } else {
                  game.endGame();
                  setScreen('podium');
                }
              }}
            />
          )}
          {quitOpen ? <QuitDialog onKeepPlaying={() => setQuitOpen(false)} onQuit={goToSetup} /> : null}
        </View>
      );
    case 'podium':
      return <PodiumScreen onPlayAgain={goToSetup} />;
  }
}

function ConnectionBanner() {
  const { state } = useGame();
  if (state.connected) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>Reconnecting to the game server…</Text>
    </View>
  );
}

export default function CouchQuizApp() {
  return (
    <GameProvider>
      <View style={styles.fill}>
        <Screens />
        <ConnectionBanner />
      </View>
    </GameProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  banner: {
    position: 'absolute',
    top: scaledPixels(24),
    alignSelf: 'center',
    backgroundColor: colors.error,
    borderRadius: scaledPixels(12),
    paddingVertical: scaledPixels(12),
    paddingHorizontal: scaledPixels(28),
  },
  bannerText: { color: colors.text, fontSize: scaledPixels(28), fontWeight: 'bold' },
});
