import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { FocusableButton } from '../components/Focusable';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { QrCode } from '../components/QrCode';
import { useGame } from '../game/GameContext';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

const QUESTION_COUNT = 10;

interface Props {
  onChangeTopic: () => void;
  onStart: () => void;
  onRetryGeneration: () => void;
}

export default function LobbyScreen({ onChangeTopic, onStart, onRetryGeneration }: Props) {
  const { state } = useGame();
  const { room, players, generation, topic } = state;

  useBackHandler(onChangeTopic);

  const hasPlayers = players.some((p) => p.connected);
  let startLabel = 'Start game ▶';
  if (generation === 'failed') startLabel = 'Try again';
  else if (generation !== 'ready') startLabel = 'Writing questions…';
  else if (!hasPlayers) startLabel = 'Waiting for players…';
  const canStart = generation === 'ready' && hasPlayers;

  return (
    <SpatialNavigationRoot>
      <View style={styles.container}>
        <View style={styles.columns}>
          <View style={styles.joinPanel}>
            <Text style={styles.panelTitle}>Scan to join</Text>
            {room ? <QrCode value={room.joinUrl} size={scaledPixels(420)} /> : <View style={styles.qrPlaceholder} />}
            <Text style={styles.joinUrl}>{room ? room.joinUrl.replace(/^https?:\/\//, '').split('?')[0] : ' '}</Text>
            <Text style={styles.roomLabel}>ROOM CODE</Text>
            <Text style={styles.roomCode}>{room?.roomCode.split('').join(' ') ?? '· · · ·'}</Text>
          </View>

          <View style={styles.playersPanel}>
            <Text style={styles.panelTitle}>Players ({players.length})</Text>
            <View style={styles.players}>
              {players.length === 0 ? (
                <Text style={styles.waiting}>Waiting for the first player to scan the code…</Text>
              ) : (
                players.map((p) => <PlayerAvatar key={p.id} player={p} />)
              )}
            </View>
            <Text style={[styles.status, generation === 'failed' && styles.statusError]}>
              {generation === 'ready'
                ? `✓ ${QUESTION_COUNT} questions about “${topic}” are ready`
                : generation === 'failed'
                  ? room
                    ? '✗ The AI host could not write the questions.'
                    : '✗ Could not reach the game server.'
                  : `🎙️ The AI host is writing ${QUESTION_COUNT} questions about “${topic}”…`}
            </Text>
          </View>
        </View>

        <SpatialNavigationView direction="horizontal" style={styles.buttons}>
          <FocusableButton label="Change topic" onSelect={onChangeTopic} />
          <DefaultFocus>
            <FocusableButton
              label={startLabel}
              disabled={generation !== 'failed' && !canStart}
              onSelect={generation === 'failed' ? onRetryGeneration : onStart}
            />
          </DefaultFocus>
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
    paddingVertical: scaledPixels(70),
    justifyContent: 'space-between',
  },
  columns: { flexDirection: 'row', gap: scaledPixels(80) },
  joinPanel: { alignItems: 'center' },
  panelTitle: { color: colors.text, fontSize: scaledPixels(40), fontWeight: 'bold', marginBottom: scaledPixels(24) },
  qrPlaceholder: { width: scaledPixels(420), height: scaledPixels(420), backgroundColor: colors.card },
  joinUrl: { color: colors.textSecondary, fontSize: scaledPixels(26), marginTop: scaledPixels(16) },
  roomLabel: { color: colors.textTertiary, fontSize: scaledPixels(24), fontWeight: 'bold', marginTop: scaledPixels(20) },
  roomCode: { color: colors.focus, fontSize: scaledPixels(80), fontWeight: 'bold' },
  playersPanel: { flex: 1 },
  players: { flexDirection: 'row', flexWrap: 'wrap', gap: scaledPixels(24), minHeight: scaledPixels(380) },
  waiting: { color: colors.textTertiary, fontSize: scaledPixels(32) },
  status: { color: colors.textSecondary, fontSize: scaledPixels(32), marginTop: scaledPixels(24) },
  statusError: { color: colors.error },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: scaledPixels(32) },
});
