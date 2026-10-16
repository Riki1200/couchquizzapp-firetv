import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { FocusableButton } from '../components/Focusable';
import { FadeIn, PopIn } from '../components/Motion';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { QrCode } from '../components/QrCode';
import { Screen } from '../components/Screen';
import { useGame } from '../game/GameContext';
import { TextKey } from '../game/types';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';
import { PRESET_TOPICS } from './SetupScreen';

interface Props {
  onChangeTopic: () => void;
  onStart: () => void;
  onRetryGeneration: () => void;
}

export default function LobbyScreen({ onChangeTopic, onStart, onRetryGeneration }: Props) {
  const { state, t } = useGame();
  const { room, players, generation, topic, questionSource } = state;
  const count = state.settings.questionCount;
  const topicLabel = PRESET_TOPICS.some((preset) => preset.label === topic) ? t(`topic.${topic}` as TextKey) : topic;

  useBackHandler(onChangeTopic);

  const hasPlayers = players.some((p) => p.connected);
  let startLabel = t('lobby.start');
  if (generation === 'failed') startLabel = t('lobby.retry');
  else if (generation !== 'ready') startLabel = t('lobby.writing');
  else if (!hasPlayers) startLabel = t('lobby.waitingPlayers');
  const canStart = generation === 'ready' && hasPlayers;

  let status = t('lobby.pending', { count, topic: topicLabel ?? '' });
  if (generation === 'ready') status = t(questionSource === 'ai' ? 'lobby.readyAi' : 'lobby.readyBank', { count, topic: topicLabel ?? '' });
  if (generation === 'failed') status = room ? t('lobby.failedAi') : t('lobby.failedServer');

  return (
    <SpatialNavigationRoot>
      <Screen style={styles.screen}>
        <View style={styles.columns}>
          <FadeIn style={styles.joinPanel}>
            <Text style={styles.panelTitle}>{t('lobby.scan')}</Text>
            <View style={styles.qrFrame}>
              {room ? (
                <PopIn>
                  <QrCode value={room.joinUrl} size={scaledPixels(400)} />
                </PopIn>
              ) : (
                <View style={styles.qrPlaceholder} />
              )}
            </View>
            <Text style={styles.joinUrl}>{room ? room.joinUrl.replace(/^https?:\/\//, '').split('?')[0] : ' '}</Text>
            <Text style={styles.roomLabel}>{t('lobby.roomCode')}</Text>
            <Text style={styles.roomCode}>{room?.roomCode.split('').join(' ') ?? '· · · ·'}</Text>
          </FadeIn>

          <FadeIn delay={150} style={styles.playersPanel}>
            <Text style={styles.panelTitle}>{t('lobby.players', { count: players.length })}</Text>
            <View style={styles.players}>
              {players.length === 0 ? (
                <Text style={styles.waiting}>{t('lobby.waiting')}</Text>
              ) : (
                players.map((p) => (
                  <PopIn key={p.id}>
                    <PlayerAvatar player={p} />
                  </PopIn>
                ))
              )}
            </View>
            <FadeIn key={generation} distance={10}>
              <Text style={[styles.status, generation === 'ready' && styles.statusReady, generation === 'failed' && styles.statusError]}>
                {status}
              </Text>
            </FadeIn>
          </FadeIn>
        </View>

        <FadeIn delay={300}>
          <SpatialNavigationView direction="horizontal" style={styles.buttons}>
            <FocusableButton label={t('lobby.changeTopic')} onSelect={onChangeTopic} />
            <DefaultFocus>
              <FocusableButton
                label={startLabel}
                disabled={generation !== 'failed' && !canStart}
                onSelect={generation === 'failed' ? onRetryGeneration : onStart}
              />
            </DefaultFocus>
          </SpatialNavigationView>
        </FadeIn>
      </Screen>
    </SpatialNavigationRoot>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between', paddingVertical: scaledPixels(64) },
  columns: { flexDirection: 'row', gap: scaledPixels(80) },
  joinPanel: { alignItems: 'center' },
  panelTitle: { color: colors.text, fontSize: scaledPixels(40), fontWeight: 'bold', marginBottom: scaledPixels(22) },
  qrFrame: {
    padding: scaledPixels(14),
    borderRadius: scaledPixels(26),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: scaledPixels(3),
    borderColor: 'rgba(255, 210, 63, 0.5)',
  },
  qrPlaceholder: { width: scaledPixels(400), height: scaledPixels(400), backgroundColor: colors.card },
  joinUrl: { color: colors.textSecondary, fontSize: scaledPixels(26), marginTop: scaledPixels(16) },
  roomLabel: { color: colors.textTertiary, fontSize: scaledPixels(24), fontWeight: 'bold', marginTop: scaledPixels(18) },
  roomCode: { color: colors.focus, fontSize: scaledPixels(80), fontWeight: 'bold', letterSpacing: scaledPixels(4) },
  playersPanel: { flex: 1 },
  players: { flexDirection: 'row', flexWrap: 'wrap', gap: scaledPixels(24), minHeight: scaledPixels(380) },
  waiting: { color: colors.textTertiary, fontSize: scaledPixels(32) },
  status: { color: colors.textSecondary, fontSize: scaledPixels(32), marginTop: scaledPixels(24) },
  statusReady: { color: colors.success },
  statusError: { color: colors.error },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: scaledPixels(32) },
});
