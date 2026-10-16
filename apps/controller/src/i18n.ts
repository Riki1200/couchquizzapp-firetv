import { createContext, useContext } from 'react';
import { BANK_TOPICS, Language, TextKey, translate } from '@couch-quiz/protocol';

/** The room's language, chosen by the host on the TV. */
export const LanguageContext = createContext<Language>('en');

export function useT() {
  const language = useContext(LanguageContext);
  return {
    t: (key: TextKey, vars?: Record<string, string | number>) => translate(language, key, vars),
    topicLabel: (topic: string) => (BANK_TOPICS.includes(topic) ? translate(language, `topic.${topic}` as TextKey) : topic),
  };
}
