import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { createGameClient } from './createGameClient';
import { GameClient, GameClientEvent } from './GameClient';
import { audioOptions } from '../audio/options';
import { speak, stopMusic, stopSpeaking } from '../audio/sounds';
import { GAME_SERVER } from '../config';
import { loadValue, saveValue } from '../storage';
import {
  Award,
  AwardSource,
  Difficulty,
  FamilyStanding,
  GenerationStatus,
  Language,
  Player,
  PlayerResult,
  QUESTION_COUNT,
  QUESTION_COUNT_OPTIONS,
  Question,
  QuestionSource,
  Room,
  TextKey,
  TopicSuggestion,
  isLanguage,
  translate,
} from './types';

const SETTINGS_KEY = 'couchquiz:settings';
const FAMILY_KEY = 'couchquiz:family';

export interface Settings {
  language: Language;
  questionCount: number;
  effects: boolean;
  music: boolean;
  /** The host reads questions and quips aloud (Amazon Polly). */
  voice: boolean;
  /** Two teams instead of everyone for themselves. */
  teams: boolean;
}

export interface GameState {
  room: Room | null;
  connected: boolean;
  players: Player[];
  topic: string | null;
  difficulty: Difficulty | null;
  generation: GenerationStatus;
  questions: Question[];
  questionSource: QuestionSource | null;
  /** The AI's questions were fact-checked by a second model. */
  factChecked: boolean;
  questionIndex: number;
  answeredIds: string[];
  /** Results of the current question once revealed. */
  results: PlayerResult[] | null;
  awards: Award[] | null;
  awardSource: AwardSource | null;
  /** Correct answers in a row per player, as of the last reveal (for the 🔥 badge). */
  streaks: Record<string, number>;
  /** Topics suggested from the phones in the lobby. */
  suggestions: TopicSuggestion[];
  /** This TV's id for the family scores (saved on the device). */
  familyId: string | null;
  /** Family scores, once loaded or after a game. */
  family: FamilyStanding[] | null;
  settings: Settings;
}

type Action =
  | { type: 'roomCreated'; room: Room }
  | { type: 'setTopic'; topic: string }
  | { type: 'setDifficulty'; difficulty: Difficulty }
  | { type: 'questionStarted'; index: number }
  | { type: 'settings'; settings: Partial<Settings> }
  | { type: 'familyId'; familyId: string }
  | { type: 'family'; family: FamilyStanding[] }
  | GameClientEvent;

const initialState: GameState = {
  room: null,
  connected: true,
  players: [],
  topic: null,
  difficulty: null,
  generation: 'idle',
  questions: [],
  questionSource: null,
  factChecked: false,
  questionIndex: 0,
  answeredIds: [],
  results: null,
  awards: null,
  awardSource: null,
  streaks: {},
  suggestions: [],
  familyId: null,
  family: null,
  settings: { language: 'en', questionCount: QUESTION_COUNT, effects: true, music: true, voice: true, teams: false },
};

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'roomCreated':
      return { ...state, room: action.room };
    case 'setTopic':
      return { ...state, topic: action.topic };
    case 'setDifficulty':
      return { ...state, difficulty: action.difficulty };
    case 'questionStarted':
      return {
        ...state,
        questionIndex: action.index,
        answeredIds: [],
        results: null,
        awards: null,
        awardSource: null,
        streaks: action.index === 0 ? {} : state.streaks, // a new game starts without streaks
      };
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'familyId':
      return { ...state, familyId: action.familyId };
    case 'family':
      return { ...state, family: action.family };
    case 'topicSuggestions':
      return { ...state, suggestions: action.suggestions };
    case 'connection':
      return { ...state, connected: action.connected };
    case 'players':
      return { ...state, players: action.players };
    case 'generation':
      return {
        ...state,
        generation: action.status,
        questions: action.questions ?? [],
        questionSource: action.source ?? null,
        factChecked: !!action.factChecked,
      };
    case 'answerProgress':
      return action.index === state.questionIndex ? { ...state, answeredIds: action.answeredPlayerIds } : state;
    case 'reveal':
      if (action.index !== state.questionIndex) return state;
      return {
        ...state,
        results: action.results,
        streaks: Object.fromEntries(action.results.map((r) => [r.playerId, r.streak])),
      };
    case 'gameOver':
      return { ...state, awards: action.awards, awardSource: action.source, family: action.family };
  }
}

interface GameContextValue {
  state: GameState;
  setTopic: (topic: string) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  /**
   * Creates the room the first time, then starts a game (new questions) for the chosen topic — or for
   * `topic`, e.g. one suggested from a phone. Players stay in the room, so this is also the rematch.
   */
  openLobby: (topic?: string) => Promise<void>;
  /** Shows question `index` on the TV (intro); the phones get it once beginQuestion() is called. */
  showQuestion: (index: number) => void;
  /** Starts the current question: phones get the answers and the server starts timing. */
  beginQuestion: () => void;
  reveal: () => void;
  endGame: () => void;
  updateSettings: (settings: Partial<Settings>) => void;
  /** The host reads the current question, or its quip after the reveal. */
  hostSays: (kind: 'question' | 'quip') => void;
  loadFamily: () => Promise<void>;
  /** "Surprise me" topic ideas in the host's language. */
  topicIdeas: () => Promise<string[]>;
  /** Text in the host's language. */
  t: (key: TextKey, vars?: Record<string, string | number>) => string;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<GameClient>(createGameClient());
  const [state, dispatch] = useReducer(reducer, initialState);

  // This TV's family id: created once and kept on the device.
  useEffect(() => {
    loadValue(FAMILY_KEY).then((saved) => {
      const familyId = saved ?? `fam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      if (!saved) saveValue(FAMILY_KEY, familyId);
      dispatch({ type: 'familyId', familyId });
    });
  }, []);

  // Restore the host's saved settings.
  useEffect(() => {
    loadValue(SETTINGS_KEY).then((saved) => {
      if (!saved) return;
      try {
        const settings = { ...initialState.settings, ...JSON.parse(saved) } as Settings;
        if (!isLanguage(settings.language) || !(QUESTION_COUNT_OPTIONS as readonly number[]).includes(settings.questionCount)) return;
        audioOptions.effects = settings.effects;
        audioOptions.music = settings.music;
        audioOptions.voice = settings.voice;
        dispatch({ type: 'settings', settings });
      } catch {
        // ignore unreadable settings
      }
    });
  }, []);

  useEffect(() => {
    const client = clientRef.current;
    const unsubscribe = client.subscribe(dispatch);
    return () => {
      unsubscribe();
      client.close();
    };
  }, []);

  const value = useMemo<GameContextValue>(() => {
    const client = clientRef.current;
    // The backend reads the line from the room's own questions; the text hash only keeps caches per game.
    const hostSays = (kind: 'question' | 'quip') => {
      const question = state.questions[state.questionIndex];
      if (!GAME_SERVER || !state.room || !question) return;
      const text = kind === 'question' ? question.text : question.quip;
      speak(`${GAME_SERVER.httpUrl}/rooms/${state.room.roomCode}/speech/${state.questionIndex}/${kind}?v=${textKey(text)}`);
    };
    return {
      state,
      setTopic: (topic) => dispatch({ type: 'setTopic', topic }),
      setDifficulty: (difficulty) => dispatch({ type: 'setDifficulty', difficulty }),
      openLobby: async (topic) => {
        try {
          if (!state.room) dispatch({ type: 'roomCreated', room: await client.createRoom(state.familyId) });
          if (topic) dispatch({ type: 'setTopic', topic });
          const { language, questionCount, teams } = state.settings;
          client.configure(topic ?? state.topic!, state.difficulty!, language, questionCount, teams);
        } catch (error) {
          console.warn('[game] could not open the lobby', error);
          dispatch({ type: 'generation', status: 'failed' }); // the lobby offers "Try again"
        }
      },
      showQuestion: (index) => {
        stopSpeaking();
        dispatch({ type: 'questionStarted', index });
      },
      beginQuestion: () => {
        client.startQuestion(state.questionIndex);
        hostSays('question');
      },
      reveal: () => client.reveal(state.questionIndex),
      endGame: () => client.endGame(),
      updateSettings: (settings) => {
        if (settings.effects !== undefined) audioOptions.effects = settings.effects;
        if (settings.voice !== undefined) {
          audioOptions.voice = settings.voice;
          if (!settings.voice) stopSpeaking();
        }
        if (settings.music !== undefined) {
          audioOptions.music = settings.music;
          if (!settings.music) stopMusic();
        }
        dispatch({ type: 'settings', settings });
        saveValue(SETTINGS_KEY, JSON.stringify({ ...state.settings, ...settings }));
      },
      hostSays,
      loadFamily: async () => {
        if (!state.familyId) return;
        try {
          dispatch({ type: 'family', family: await client.getFamily(state.familyId) });
        } catch (error) {
          console.warn('[game] could not load the family scores', error);
          dispatch({ type: 'family', family: [] });
        }
      },
      topicIdeas: () => client.topicIdeas(state.settings.language, state.difficulty ?? 'easy'),
      t: (key, vars) => translate(state.settings.language, key, vars),
    };
  }, [state]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

/** A short, stable key for a line of text (cache-busting for the host's speech URLs). */
function textKey(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error('useGame must be used inside GameProvider');
  return value;
}
