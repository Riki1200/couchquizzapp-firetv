import type { Language } from './i18n';

/** Topic ideas for "Surprise me" when the AI host is not available. */
export const TOPIC_IDEAS: Record<Language, string[]> = {
  en: [
    'Volcanoes', 'Pirates', 'The human body', 'Musical instruments', 'Rainforests', 'Inventions',
    'Insects', 'World flags', 'Castles and knights', 'Weather', 'Ancient Egypt', 'Sports around the world',
    'Robots', 'Fruits and vegetables', 'Mountains', 'Famous paintings', 'Trains', 'Birds',
  ],
  es: [
    'Volcanes', 'Piratas', 'El cuerpo humano', 'Instrumentos musicales', 'Selvas tropicales', 'Inventos',
    'Insectos', 'Banderas del mundo', 'Castillos y caballeros', 'El clima', 'El antiguo Egipto', 'Deportes del mundo',
    'Robots', 'Frutas y verduras', 'Montañas', 'Pinturas famosas', 'Trenes', 'Aves',
  ],
};

/** `count` different ideas, in random order. */
export function randomIdeas(language: Language, count: number): string[] {
  return [...TOPIC_IDEAS[language]].sort(() => Math.random() - 0.5).slice(0, count);
}
