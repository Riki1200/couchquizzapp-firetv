// TV sound effects on Vega, played with the W3C media AudioPlayer. Same API as sounds.ts.
//
// Two Vega specifics shape this file (see docs/friction-log.md):
// - AudioPlayer only accepts HTTPS sources (see SOUNDS_URL in config.ts).
// - A player that reached the end does not play again (rewinding or load() + play() stays silent),
//   so every play uses a fresh player. To keep the delay short, one player per sound is always
//   loaded in advance and released when it finishes.
import { AudioPlayer } from '@amazon-devices/react-native-w3cmedia';
import { SOUNDS_URL } from '../config';
import { audioOptions } from './options';
import type { SoundName } from './sounds';

type Name = SoundName | 'music';

const NAMES: Name[] = ['join', 'lock', 'tick', 'timesup', 'reveal', 'podium', 'music'];
const VOLUME: Record<Name, number> = {
  join: 0.8,
  lock: 0.6,
  tick: 0.5,
  timesup: 0.8,
  reveal: 0.9,
  podium: 1,
  music: 0.35,
};

interface Loaded {
  audio: AudioPlayer;
  failed: boolean;
}

/** The next player for each sound, already loaded. */
const nextPlayer = new Map<Name, Promise<Loaded | null>>();
let music: Promise<AudioPlayer | null> | null = null;

function load(name: Name): Promise<Loaded | null> {
  return (async () => {
    const audio = new AudioPlayer();
    await audio.initialize();
    const loaded: Loaded = { audio, failed: false };
    audio.addEventListener('error' as never, () => {
      loaded.failed = true;
      console.warn(`[sounds] ${name} failed to load (code ${audio.error?.code})`);
    });
    audio.src = `${SOUNDS_URL}/sounds/${name}.m4a`;
    audio.volume = VOLUME[name];
    audio.loop = name === 'music';
    audio.load();
    return loaded;
  })().catch((error) => {
    console.warn(`[sounds] ${name} could not be created`, error);
    return null;
  });
}

/** Hands out the preloaded player (or a new one if it failed) and starts loading the next one. */
async function take(name: Name): Promise<AudioPlayer | null> {
  const ready = nextPlayer.get(name) ?? load(name);
  nextPlayer.set(name, load(name));
  let loaded = await ready;
  if (!loaded || loaded.failed) {
    release(loaded?.audio);
    loaded = await load(name);
  }
  return loaded?.audio ?? null;
}

function release(audio: AudioPlayer | undefined) {
  audio?.deinitialize().catch(() => {});
}

/** Loads one player per sound, one after another (loading them all at once made some fail). */
export function preloadSounds() {
  if (!SOUNDS_URL) return;
  NAMES.reduce<Promise<unknown>>(
    (previous, name) =>
      previous.then(() => {
        const ready = load(name);
        nextPlayer.set(name, ready);
        return ready;
      }),
    Promise.resolve(),
  );
}

export function playSound(name: SoundName) {
  if (!SOUNDS_URL || !audioOptions.effects) return;
  take(name).then((audio) => {
    if (!audio) return;
    audio.addEventListener('ended' as never, () => release(audio));
    audio.play();
  });
}

export function startMusic() {
  if (!SOUNDS_URL || !audioOptions.music || music) return;
  music = take('music').then((audio) => {
    audio?.play();
    return audio;
  });
}

export function stopMusic() {
  const playing = music;
  music = null;
  playing?.then((audio) => {
    audio?.pause();
    release(audio ?? undefined);
  });
}
