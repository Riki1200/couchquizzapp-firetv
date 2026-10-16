import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { DefaultFocus, SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import { FocusableButton, OptionTile } from '../components/Focusable';
import { FadeIn } from '../components/Motion';
import { Screen } from '../components/Screen';
import { useGame } from '../game/GameContext';
import { LANGUAGES, QUESTION_COUNT_OPTIONS } from '../game/types';
import { useBackHandler } from '../hooks/useBackHandler';
import { scaledPixels } from '../hooks/useScale';
import { colors } from '../theme/colors';

const TILE_WIDTH = scaledPixels(240);

/** Host settings: language (TV, phones and questions), questions per game, sound effects, music. */
export default function SettingsScreen({ onDone }: { onDone: () => void }) {
  const { state, updateSettings, t } = useGame();
  const { settings } = state;
  useBackHandler(onDone);

  const row = (label: string, delay: number, tiles: React.ReactNode) => (
    <FadeIn delay={delay} style={styles.setting}>
      <Text style={styles.label}>{label}</Text>
      <SpatialNavigationView direction="horizontal" style={styles.row}>
        {tiles}
      </SpatialNavigationView>
    </FadeIn>
  );
  const onOff = (value: boolean, change: (value: boolean) => void) => [
    <OptionTile key="on" width={TILE_WIDTH} label={t('settings.on')} icon="🔊" selected={value} onSelect={() => change(true)} />,
    <OptionTile key="off" width={TILE_WIDTH} label={t('settings.off')} icon="🔇" selected={!value} onSelect={() => change(false)} />,
  ];

  return (
    <SpatialNavigationRoot>
      <Screen>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <SpatialNavigationView direction="vertical" style={styles.sections}>
          {row(
            t('settings.language'),
            80,
            LANGUAGES.map((language, i) => {
              const tile = (
                <OptionTile
                  key={language.code}
                  width={TILE_WIDTH}
                  label={language.label}
                  icon={language.code === 'en' ? '🇬🇧' : '🇪🇸'}
                  selected={settings.language === language.code}
                  onSelect={() => updateSettings({ language: language.code })}
                />
              );
              return i === 0 ? <DefaultFocus key={language.code}>{tile}</DefaultFocus> : tile;
            }),
          )}
          {row(
            t('settings.questions'),
            160,
            QUESTION_COUNT_OPTIONS.map((count) => (
              <OptionTile
                key={count}
                width={TILE_WIDTH}
                label={String(count)}
                icon={count === 5 ? '⚡' : '🎯'}
                selected={settings.questionCount === count}
                onSelect={() => updateSettings({ questionCount: count })}
              />
            )),
          )}
          <SpatialNavigationView direction="horizontal" style={styles.pair}>
            {row(t('settings.sound'), 240, onOff(settings.effects, (effects) => updateSettings({ effects })))}
            {row(t('settings.music'), 320, onOff(settings.music, (music) => updateSettings({ music })))}
          </SpatialNavigationView>
          <FadeIn delay={400} style={styles.footer}>
            <Text style={styles.note}>{t('settings.note')}</Text>
            <FocusableButton label={t('settings.done')} onSelect={onDone} />
          </FadeIn>
        </SpatialNavigationView>
      </Screen>
    </SpatialNavigationRoot>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.focus, fontSize: scaledPixels(72), fontWeight: 'bold', marginBottom: scaledPixels(24) },
  sections: { gap: scaledPixels(26) },
  setting: { gap: scaledPixels(12) },
  label: { color: colors.textSecondary, fontSize: scaledPixels(30), fontWeight: 'bold' },
  row: { flexDirection: 'row', gap: scaledPixels(24) },
  pair: { flexDirection: 'row', gap: scaledPixels(80) },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: scaledPixels(8) },
  note: { color: colors.textTertiary, fontSize: scaledPixels(26), flex: 1, marginRight: scaledPixels(40) },
});
