import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { FocusableButton } from '../components/Focusable';
import { FadeIn } from '../components/Motion';
import { Screen } from '../components/Screen';
import { useGame } from '../game/GameContext';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

const MAX_ROWS = 8;
const MEDALS = ['🥇', '🥈', '🥉'];

/** Totals per person over every game finished on this TV (stored in the backend by family id). */
export default function FamilyScreen({ onDone }: { onDone: () => void }) {
  const { state, loadFamily, t } = useGame();
  useBackHandler(onDone);
  useEffect(() => {
    loadFamily();
    // Load once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = (state.family ?? []).slice(0, MAX_ROWS);
  return (
    <SpatialNavigationRoot>
      <Screen>
        <Text style={styles.title}>{t('family.title')}</Text>
        <Text style={styles.subtitle}>{t('family.subtitle')}</Text>

        <View style={styles.table}>
          {state.family === null ? null : rows.length === 0 ? (
            <FadeIn>
              <Text style={styles.empty}>{t('family.empty')}</Text>
            </FadeIn>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={[styles.head, styles.nameCol, styles.headName]}>{t('family.player')}</Text>
                <Text style={styles.head}>{t('family.wins')}</Text>
                <Text style={styles.head}>{t('family.games')}</Text>
                <Text style={styles.head}>{t('family.points')}</Text>
                <Text style={styles.head}>{t('family.best')}</Text>
              </View>
              {rows.map((s, i) => (
                <FadeIn key={s.name} delay={80 * i} distance={30}>
                  <View style={[styles.row, styles.card, i === 0 && styles.leader]}>
                    <Text style={styles.rank}>{MEDALS[i] ?? i + 1}</Text>
                    <Text style={styles.avatar}>{s.avatar}</Text>
                    <Text style={[styles.name, styles.nameCol]} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={[styles.cell, styles.wins]}>{s.wins}</Text>
                    <Text style={styles.cell}>{s.games}</Text>
                    <Text style={styles.cell}>{s.points.toLocaleString()}</Text>
                    <Text style={styles.cell}>{s.best.toLocaleString()}</Text>
                  </View>
                </FadeIn>
              ))}
            </>
          )}
        </View>

        <View style={styles.footer}>
          <DefaultFocus>
            <FocusableButton label={t('family.done')} onSelect={onDone} />
          </DefaultFocus>
        </View>
      </Screen>
    </SpatialNavigationRoot>
  );
}

const CELL_WIDTH = scaledPixels(200);

const styles = StyleSheet.create({
  title: { color: colors.focus, fontSize: scaledPixels(72), fontWeight: 'bold' },
  subtitle: { color: colors.textSecondary, fontSize: scaledPixels(30), marginBottom: scaledPixels(28) },
  table: { flex: 1, gap: scaledPixels(10) },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scaledPixels(24) },
  card: {
    height: scaledPixels(70),
    borderRadius: scaledPixels(16),
    backgroundColor: 'rgba(26, 33, 72, 0.9)',
  },
  leader: { backgroundColor: 'rgba(108, 92, 231, 0.9)' },
  head: { color: colors.textTertiary, fontSize: scaledPixels(24), fontWeight: 'bold', width: CELL_WIDTH, textAlign: 'right' },
  nameCol: { flex: 1, textAlign: 'left' },
  // The header's name column starts where the names do (after the rank and avatar columns).
  headName: { paddingLeft: scaledPixels(126) },
  rank: { color: colors.focus, fontSize: scaledPixels(32), fontWeight: 'bold', width: scaledPixels(60) },
  avatar: { fontSize: scaledPixels(40), width: scaledPixels(66) },
  name: { color: colors.text, fontSize: scaledPixels(34), fontWeight: 'bold' },
  cell: { color: colors.text, fontSize: scaledPixels(32), width: CELL_WIDTH, textAlign: 'right' },
  wins: { color: colors.focus, fontWeight: 'bold' },
  empty: { color: colors.textSecondary, fontSize: scaledPixels(36), marginTop: scaledPixels(40) },
  footer: { flexDirection: 'row', justifyContent: 'flex-end' },
});
