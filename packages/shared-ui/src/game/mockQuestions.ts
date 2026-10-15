import { Question } from './types';

// Bundled "Space for kids" pack: used by MockGameClient during development,
// and later as the fallback when question generation fails during a demo.
export const SPACE_FOR_KIDS: Question[] = [
  {
    text: 'What is the closest star to Earth?',
    choices: ['Polaris', 'The Sun', 'Sirius', 'The Moon'],
    correctIndex: 1,
    quip: "Hot take: it's the Sun. Literally.",
  },
  {
    text: 'Which planet is known as the Red Planet?',
    choices: ['Venus', 'Jupiter', 'Mercury', 'Mars'],
    correctIndex: 3,
    quip: 'Mars: rusty, dusty, and totally red-y.',
  },
  {
    text: 'What is the biggest planet in our solar system?',
    choices: ['Jupiter', 'Saturn', 'Earth', 'Neptune'],
    correctIndex: 0,
    quip: 'You could fit over 1,000 Earths inside Jupiter. Big house!',
  },
  {
    text: 'How many planets are in our solar system?',
    choices: ['7', '9', '8', '10'],
    correctIndex: 2,
    quip: "Eight! Sorry, Pluto — you're still a star to us.",
  },
  {
    text: 'What do astronauts wear to breathe in space?',
    choices: ['A raincoat', 'A space suit', 'Pajamas', 'A snorkel'],
    correctIndex: 1,
    quip: 'Pajamas are comfy, but terrible at making oxygen.',
  },
  {
    text: 'Which planet has the most famous rings?',
    choices: ['Mars', 'Earth', 'Venus', 'Saturn'],
    correctIndex: 3,
    quip: 'Saturn put a ring on it. Lots of rings, actually.',
  },
  {
    text: 'What is the Moon mostly covered with?',
    choices: ['Rock and dust', 'Cheese', 'Water', 'Grass'],
    correctIndex: 0,
    quip: 'Sorry, cheese fans. Rock and dust only.',
  },
  {
    text: 'What pulls things down toward the ground?',
    choices: ['Wind', 'Light', 'Gravity', 'Magnets'],
    correctIndex: 2,
    quip: 'Gravity: keeping your snacks on the table since forever.',
  },
  {
    text: 'Which planet is closest to the Sun?',
    choices: ['Venus', 'Mercury', 'Earth', 'Mars'],
    correctIndex: 1,
    quip: 'Mercury is so close to the Sun it needs serious sunscreen.',
  },
  {
    text: 'What do we call a group of stars that makes a picture in the sky?',
    choices: ['A comet', 'A galaxy', 'A planet', 'A constellation'],
    correctIndex: 3,
    quip: 'Connect-the-dots, cosmic edition!',
  },
];
