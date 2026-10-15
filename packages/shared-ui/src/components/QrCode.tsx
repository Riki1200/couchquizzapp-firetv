import React, { useMemo } from 'react';
import { View } from 'react-native';
import qrcode from 'qrcode-generator';

const QUIET_ZONE_MODULES = 4;

/**
 * QR code drawn with plain Views (no SVG or native module), which renders on Vega,
 * Android TV and web. Consecutive same-color cells in a row are merged into one View.
 */
export function QrCode({ value, size }: { value: string; size: number }) {
  const rows = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    const result: Array<Array<{ dark: boolean; length: number }>> = [];
    for (let r = 0; r < count; r++) {
      const runs: Array<{ dark: boolean; length: number }> = [];
      for (let c = 0; c < count; c++) {
        const dark = qr.isDark(r, c);
        const last = runs[runs.length - 1];
        if (last && last.dark === dark) last.length++;
        else runs.push({ dark, length: 1 });
      }
      result.push(runs);
    }
    return result;
  }, [value]);

  const cell = size / (rows.length + QUIET_ZONE_MODULES * 2);
  return (
    <View style={{ width: size, height: size, padding: cell * QUIET_ZONE_MODULES, backgroundColor: '#fff' }}>
      {rows.map((runs, r) => (
        <View key={r} style={{ flexDirection: 'row', height: cell }}>
          {runs.map((run, i) => (
            <View key={i} style={{ width: cell * run.length, backgroundColor: run.dark ? '#000' : '#fff' }} />
          ))}
        </View>
      ))}
    </View>
  );
}
