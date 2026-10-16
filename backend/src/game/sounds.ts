import { readFileSync } from 'fs';
import { join } from 'path';

const SOUND_NAMES = ['join', 'lock', 'tick', 'timesup', 'reveal', 'podium', 'music'];

/**
 * The TV's sound effects (synthesized by scripts/make-sounds.py), served by the game backend
 * so the TV app can stream them by URL on every platform. Returns null for unknown names.
 */
export function readSound(dir: string, file: string): Buffer | null {
  const name = file.replace(/\.m4a$/, '');
  if (!SOUND_NAMES.includes(name)) return null;
  return readFileSync(join(dir, `${name}.m4a`));
}
