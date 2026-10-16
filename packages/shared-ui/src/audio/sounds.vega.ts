// TV sound effects on Vega, played with the W3C media AudioPlayer. Same API as sounds.ts.
// Note: AudioPlayer only accepts HTTPS sources (see SOUNDS_URL in config.ts).
import { AudioPlayer } from '@amazon-devices/react-native-w3cmedia';
import { SOUNDS_URL } from '../config';
import type { SoundName } from './sounds';

const NAMES = ['join', 'lock', 'tick', 'timesup', 'reveal', 'podium', 'music'] as const;
const VOLUME: Record<SoundName | 'music', number> = {
  join: 0.8,
  lock: 0.6,
  tick: 0.5,
  timesup: 0.8,
  reveal: 0.9,
  podium: 1,
  music: 0.35,
};

const players = new Map<string, Promise<AudioPlayer>>();

function player(name: SoundName | 'music'): Promise<AudioPlayer> | null {
  if (!SOUNDS_URL) return null;
  let ready = players.get(name);
  if (!ready) {
    ready = (async () => {
      const audio = new AudioPlayer();
      await audio.initialize();
      audio.src = `${SOUNDS_URL}/sounds/${name}.m4a`;
      audio.volume = VOLUME[name];
      audio.loop = name === 'music';
      audio.addEventListener('error' as never, () => {
        console.warn(`[sounds] ${name} failed to load (code ${audio.error?.code})`);
        players.delete(name); // try again with a new player next time
      });
      audio.load();
      return audio;
    })();
    ready.catch((error) => console.warn(`[sounds] ${name} could not be loaded`, error));
    players.set(name, ready);
  }
  return ready;
}

/** Loads the players one after another; loading them all at once made some fail on the VVD. */
export function preloadSounds() {
  NAMES.reduce<Promise<unknown>>((previous, name) => previous.then(() => player(name)).catch(() => {}), Promise.resolve());
}

export function playSound(name: SoundName) {
  player(name)
    ?.then((audio) => {
      audio.currentTime = 0;
      audio.play();
    })
    .catch(() => {});
}

export function startMusic() {
  player('music')
    ?.then((audio) => audio.play())
    .catch(() => {});
}

export function stopMusic() {
  players
    .get('music')
    ?.then((audio) => {
      audio.pause();
      audio.currentTime = 0;
    })
    .catch(() => {});
}
