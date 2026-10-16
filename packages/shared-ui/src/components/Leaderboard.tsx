import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Player, PlayerResult, TEAMS, teamTotals } from '../game/types';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';
import { CountUp, nativeDriver } from './Motion';

const ROW_HEIGHT = scaledPixels(50);
const MAX_ROWS = 5;
/** Rows start in their old place and slide to the new one after the answer reveal settles. */
const MOVE_DELAY_MS = 900;

interface Row {
  player: Player;
  total: number;
  previous: number;
  oldRank: number;
  newRank: number;
}

/**
 * Standings after a question: rows slide from their previous rank to the new one, scores count up
 * from the previous total, and ▲/▼ show places gained or lost.
 */
export function Leaderboard({ players, results }: { players: Player[]; results: PlayerResult[] }) {
  const rows = rank(players, results).slice(0, MAX_ROWS);
  return (
    <View style={[styles.board, { height: rows.length * ROW_HEIGHT }]}>
      {rows.map((row) => (
        <LeaderboardRow key={row.player.id} row={row} />
      ))}
    </View>
  );
}

function LeaderboardRow({ row }: { row: Row }) {
  const offset = useRef(new Animated.Value((Math.min(row.oldRank, MAX_ROWS) - row.newRank) * ROW_HEIGHT)).current;
  // Rank number and leader highlight switch when the row starts moving, not before.
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    Animated.spring(offset, { toValue: 0, delay: MOVE_DELAY_MS, friction: 7, tension: 60, useNativeDriver: nativeDriver }).start();
    const timer = setTimeout(() => setMoved(true), MOVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [offset]);
  const change = row.oldRank - row.newRank;
  const shownRank = moved ? row.newRank : row.oldRank;
  return (
    <Animated.View style={[styles.row, { top: row.newRank * ROW_HEIGHT, transform: [{ translateY: offset }] }, shownRank === 0 && styles.leader]}>
      <Text style={styles.rank}>{shownRank + 1}</Text>
      <Text style={styles.avatar}>{row.player.avatar}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {row.player.name}
      </Text>
      <Text style={[styles.change, moved && change > 0 ? styles.up : moved && change < 0 ? styles.down : null]}>
        {!moved || change === 0 ? '–' : change > 0 ? `▲${change}` : `▼${-change}`}
      </Text>
      <CountUp value={row.total} from={row.previous} delay={MOVE_DELAY_MS} duration={1000} style={styles.score} />
    </Animated.View>
  );
}

/** Team mode: each team's total, with a bar sized by its share of the points. */
export function TeamScores({ players, label }: { players: Player[]; label: (team: number) => string }) {
  const totals = teamTotals(players);
  const max = Math.max(1, ...totals);
  return (
    <View style={styles.teams}>
      {TEAMS.map((team, i) => (
        <View key={i} style={styles.teamRow}>
          <Text style={styles.teamName} numberOfLines={1}>
            {team.emoji} {label(i)}
          </Text>
          <View style={styles.teamTrack}>
            <View style={[styles.teamBar, { backgroundColor: team.color, width: `${Math.round((totals[i] / max) * 100)}%` }]} />
          </View>
          <CountUp value={totals[i]} duration={900} style={styles.score} />
        </View>
      ))}
    </View>
  );
}

/** Ranks before this question (total − points) and after it. Ties keep a stable order by name. */
function rank(players: Player[], results: PlayerResult[]): Row[] {
  const rows = players.map((player) => {
    const result = results.find((r) => r.playerId === player.id);
    const total = result?.total ?? player.score;
    return { player, total, previous: total - (result?.points ?? 0), oldRank: 0, newRank: 0 };
  });
  const order = (key: 'total' | 'previous') =>
    [...rows].sort((a, b) => b[key] - a[key] || a.player.name.localeCompare(b.player.name));
  order('previous').forEach((row, i) => (row.oldRank = i));
  order('total').forEach((row, i) => (row.newRank = i));
  return order('total');
}

const styles = StyleSheet.create({
  board: { width: scaledPixels(560), overflow: 'hidden' },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT - scaledPixels(6),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaledPixels(16),
    borderRadius: scaledPixels(12),
    backgroundColor: 'rgba(26, 33, 72, 0.88)',
  },
  leader: { backgroundColor: 'rgba(108, 92, 231, 0.9)' },
  rank: { color: colors.focus, fontSize: scaledPixels(26), fontWeight: 'bold', width: scaledPixels(34) },
  avatar: { fontSize: scaledPixels(28), marginRight: scaledPixels(10) },
  name: { color: colors.text, fontSize: scaledPixels(26), fontWeight: 'bold', flex: 1 },
  change: { color: colors.textTertiary, fontSize: scaledPixels(22), fontWeight: 'bold', width: scaledPixels(60), textAlign: 'center' },
  up: { color: colors.success },
  down: { color: colors.error },
  score: { color: colors.text, fontSize: scaledPixels(26), fontWeight: 'bold', width: scaledPixels(90), textAlign: 'right' },
  teams: { width: scaledPixels(560), gap: scaledPixels(8), marginBottom: scaledPixels(12) },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: scaledPixels(12) },
  teamName: { color: colors.text, fontSize: scaledPixels(24), fontWeight: 'bold', width: scaledPixels(190) },
  teamTrack: { flex: 1, height: scaledPixels(18), borderRadius: scaledPixels(9), backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  teamBar: { height: '100%', borderRadius: scaledPixels(9) },
});
