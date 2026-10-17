import { Language } from '@couch-quiz/protocol';

/** The host's spoken voice: text in, audio out. PollyHostVoice in AWS; none for local play without AWS. */
export interface HostVoice {
  /** MP3 audio of `text` read in `language`, or throws. */
  synthesize(text: string, language: Language): Promise<Uint8Array>;
}
