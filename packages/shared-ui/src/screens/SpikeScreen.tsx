// Day 1 spike: verifies the risky platform pieces (QR rendering, emoji,
// text input + on-screen keyboard, WebSocket) on web and in the Vega Virtual Device.
// Throwaway — delete once the real screens exist.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { DefaultFocus, SpatialNavigationNode, SpatialNavigationRoot } from 'react-tv-space-navigation';
import qrcode from 'qrcode-generator';
import FocusablePressable from '../components/FocusablePressable';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

const ECHO_URL = 'wss://echo.websocket.org';

function QrCode({ value, size }: { value: string; size: number }) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const cell = size / count;
  const rows = [];
  for (let r = 0; r < count; r++) {
    const cells = [];
    for (let c = 0; c < count; c++) {
      cells.push(
        <View key={c} style={{ width: cell, height: cell, backgroundColor: qr.isDark(r, c) ? '#000' : '#fff' }} />,
      );
    }
    rows.push(
      <View key={r} style={{ flexDirection: 'row' }}>
        {cells}
      </View>,
    );
  }
  return <View style={{ padding: cell * 4, backgroundColor: '#fff' }}>{rows}</View>;
}

export default function SpikeScreen() {
  const [wsStatus, setWsStatus] = useState('connecting…');
  const [lastEcho, setLastEcho] = useState('');
  const [text, setText] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const ws = new WebSocket(ECHO_URL);
    wsRef.current = ws;
    ws.onopen = () => setWsStatus('open');
    ws.onmessage = (e) => setLastEcho(String(e.data));
    ws.onerror = (e) => setWsStatus(`error: ${(e as any).message ?? 'unknown'}`);
    ws.onclose = (e) => setWsStatus(`closed (${e.code})`);
    return () => ws.close();
  }, []);

  const sendPing = () => wsRef.current?.send(JSON.stringify({ ping: Date.now() }));

  return (
    <SpatialNavigationRoot>
      <View style={styles.container}>
        <Text style={styles.title}>Couch Quiz — platform spike</Text>
        <View style={styles.row}>
          <QrCode value="https://example.com/join?room=KXQP" size={scaledPixels(320)} />
          <View style={styles.col}>
            <Text style={styles.label}>Emoji: 🦊 🐼 🐙 🦄 🚀 🐢</Text>
            <Text style={styles.label}>WebSocket: {wsStatus}</Text>
            <Text style={styles.label} numberOfLines={1}>
              Last echo: {lastEcho}
            </Text>
            <Text style={styles.label}>Typed: {text}</Text>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder="Custom topic"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
            <SpatialNavigationNode orientation="horizontal">
              <View style={styles.buttons}>
                <DefaultFocus>
                  <FocusablePressable text="Send WS ping" onSelect={sendPing} />
                </DefaultFocus>
                <FocusablePressable text="Type topic" onSelect={() => inputRef.current?.focus()} />
              </View>
            </SpatialNavigationNode>
          </View>
        </View>
      </View>
    </SpatialNavigationRoot>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: scaledPixels(80) },
  title: { color: colors.text, fontSize: scaledPixels(48), fontWeight: 'bold', marginBottom: scaledPixels(40) },
  row: { flexDirection: 'row', gap: scaledPixels(60) },
  col: { flex: 1, gap: scaledPixels(20) },
  label: { color: colors.text, fontSize: scaledPixels(30) },
  input: {
    color: colors.text,
    fontSize: scaledPixels(30),
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: scaledPixels(8),
    padding: scaledPixels(16),
  },
  buttons: { flexDirection: 'row', gap: scaledPixels(24) },
});
