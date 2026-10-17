import { PollyClient, SynthesizeSpeechCommand, VoiceId } from '@aws-sdk/client-polly';
import { Language } from '@couch-quiz/protocol';
import { HostVoice } from '../game/voice';

/** Neural voices that suit a game-show host, per language. */
const VOICES: Record<Language, VoiceId> = { en: 'Matthew', es: 'Pedro' };

/** The host's voice with Amazon Polly (neural engine, MP3). Uses the Lambda role or local AWS credentials. */
export class PollyHostVoice implements HostVoice {
  private polly = new PollyClient({});

  async synthesize(text: string, language: Language): Promise<Uint8Array> {
    const started = Date.now();
    const { AudioStream } = await this.polly.send(
      new SynthesizeSpeechCommand({ Engine: 'neural', OutputFormat: 'mp3', VoiceId: VOICES[language], Text: text }),
    );
    if (!AudioStream) throw new Error('Polly returned no audio');
    const audio = await AudioStream.transformToByteArray();
    console.log(`[polly] ${VOICES[language]} ${text.length} chars → ${audio.length} bytes in ${Date.now() - started}ms`);
    return audio;
  }
}
