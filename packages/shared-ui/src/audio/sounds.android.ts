// TV sound effects, music and the host's voice on Android TV / Fire OS, played with expo-audio.
// Same API as sounds.ts (web) and sounds.vega.ts. Files are streamed from the game backend.
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
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

/** One player per sound, created once and rewound for every play. */
const players = new Map<Name, AudioPlayer>();

function player(name: Name): AudioPlayer | null {
  if (!SOUNDS_URL) return null;
  let audio = players.get(name);
  if (!audio) {
    try {
      audio = createAudioPlayer({ uri: `${SOUNDS_URL}/sounds/${name}.m4a` });
      audio.volume = VOLUME[name];
      audio.loop = name === 'music';
      players.set(name, audio);
    } catch (error) {
      console.warn(`[sounds] ${name} could not be created`, error);
      return null;
    }
  }
  return audio;
}

export function preloadSounds() {
  NAMES.forEach(player);
}

export function playSound(name: SoundName) {
  if (!audioOptions.effects) return;
  const audio = player(name);
  if (!audio) return;
  audio
    .seekTo(0)
    .then(() => audio.play())
    .catch(() => audio.play());
}

export function startMusic() {
  if (!audioOptions.music) return;
  player('music')?.play();
}

export function stopMusic() {
  const music = players.get('music');
  if (!music) return;
  music.pause();
  music.seekTo(0).catch(() => {});
}

let speech: AudioPlayer | null = null;

/** The host's voice (Amazon Polly, streamed from the backend). Cuts off whatever the host was saying. */
export function speak(url: string) {
  stopSpeaking();
  if (!audioOptions.voice) return;
  try {
    const audio = createAudioPlayer({ uri: url });
    audio.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        if (speech === audio) speech = null;
        audio.remove();
      }
    });
    audio.play();
    speech = audio;
  } catch (error) {
    console.warn('[voice] could not play', error);
  }
}

export function stopSpeaking() {
  const playing = speech;
  speech = null;
  if (!playing) return;
  playing.pause();
  playing.remove();
}
