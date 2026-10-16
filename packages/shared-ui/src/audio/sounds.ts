// TV sound effects on web (HTML <audio>). Vega uses sounds.vega.ts. The files are streamed
// from the game backend (GET /sounds/{name}.m4a); without a backend the game is silent.
import { SOUNDS_URL } from '../config';

export type SoundName = 'join' | 'lock' | 'tick' | 'timesup' | 'reveal' | 'podium';

const VOLUME: Record<SoundName | 'music', number> = {
  join: 0.8,
  lock: 0.6,
  tick: 0.5,
  timesup: 0.8,
  reveal: 0.9,
  podium: 1,
  music: 0.35,
};

const elements = new Map<string, HTMLAudioElement>();
const supported = typeof Audio !== 'undefined' && SOUNDS_URL !== null;

function element(name: SoundName | 'music'): HTMLAudioElement | null {
  if (!supported) return null;
  let audio = elements.get(name);
  if (!audio) {
    audio = new Audio(`${SOUNDS_URL}/sounds/${name}.m4a`);
    audio.preload = 'auto';
    audio.volume = VOLUME[name];
    audio.loop = name === 'music';
    elements.set(name, audio);
  }
  return audio;
}

export function preloadSounds() {
  (['join', 'lock', 'tick', 'timesup', 'reveal', 'podium', 'music'] as const).forEach(element);
}

export function playSound(name: SoundName) {
  const audio = element(name);
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {}); // browsers block audio until the first key press
}

export function startMusic() {
  element('music')?.play().catch(() => {});
}

export function stopMusic() {
  const music = elements.get('music');
  if (!music) return;
  music.pause();
  music.currentTime = 0;
}
