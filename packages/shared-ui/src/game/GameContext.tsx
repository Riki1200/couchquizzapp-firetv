import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { createGameClient } from './createGameClient';
import { GameClient, GameClientEvent } from './GameClient';
import { audioOptions } from '../audio/options';
import { stopMusic } from '../audio/sounds';
import {
  Award,
  AwardSource,
  Difficulty,
  GenerationStatus,
  Language,
  Player,
  PlayerResult,
  QUESTION_COUNT,
  Question,
  QuestionSource,
  Room,
  TextKey,
  translate,
} from './types';

export interface Settings {
  language: Language;
  questionCount: number;
  effects: boolean;
  music: boolean;
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
  questionIndex: number;
  answeredIds: string[];
  /** Results of the current question once revealed. */
  results: PlayerResult[] | null;
  awards: Award[] | null;
  awardSource: AwardSource | null;
  settings: Settings;
}

type Action =
  | { type: 'roomCreated'; room: Room }
  | { type: 'setTopic'; topic: string }
  | { type: 'setDifficulty'; difficulty: Difficulty }
  | { type: 'questionStarted'; index: number }
  | { type: 'settings'; settings: Partial<Settings> }
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
  questionIndex: 0,
  answeredIds: [],
  results: null,
  awards: null,
  awardSource: null,
  settings: { language: 'en', questionCount: QUESTION_COUNT, effects: true, music: true },
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
      return { ...state, questionIndex: action.index, answeredIds: [], results: null, awards: null, awardSource: null };
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'connection':
      return { ...state, connected: action.connected };
    case 'players':
      return { ...state, players: action.players };
    case 'generation':
      return { ...state, generation: action.status, questions: action.questions ?? [], questionSource: action.source ?? null };
    case 'answerProgress':
      return action.index === state.questionIndex ? { ...state, answeredIds: action.answeredPlayerIds } : state;
    case 'reveal':
      return action.index === state.questionIndex ? { ...state, results: action.results } : state;
    case 'gameOver':
      return { ...state, awards: action.awards, awardSource: action.source };
  }
}

interface GameContextValue {
  state: GameState;
  setTopic: (topic: string) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  /** Creates the room the first time, then (re)starts question generation for the chosen topic. */
  openLobby: () => Promise<void>;
  /** Shows question `index` on the TV (intro); the phones get it once beginQuestion() is called. */
  showQuestion: (index: number) => void;
  /** Starts the current question: phones get the answers and the server starts timing. */
  beginQuestion: () => void;
  reveal: () => void;
  endGame: () => void;
  updateSettings: (settings: Partial<Settings>) => void;
  /** Text in the host's language. */
  t: (key: TextKey, vars?: Record<string, string | number>) => string;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<GameClient>(createGameClient());
  const [state, dispatch] = useReducer(reducer, initialState);

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
    return {
      state,
      setTopic: (topic) => dispatch({ type: 'setTopic', topic }),
      setDifficulty: (difficulty) => dispatch({ type: 'setDifficulty', difficulty }),
      openLobby: async () => {
        try {
          if (!state.room) dispatch({ type: 'roomCreated', room: await client.createRoom() });
          const { language, questionCount } = state.settings;
          client.configure(state.topic!, state.difficulty!, language, questionCount);
        } catch (error) {
          console.warn('[game] could not open the lobby', error);
          dispatch({ type: 'generation', status: 'failed' }); // the lobby offers "Try again"
        }
      },
      showQuestion: (index) => dispatch({ type: 'questionStarted', index }),
      beginQuestion: () => client.startQuestion(state.questionIndex),
      reveal: () => client.reveal(state.questionIndex),
      endGame: () => client.endGame(),
      updateSettings: (settings) => {
        if (settings.effects !== undefined) audioOptions.effects = settings.effects;
        if (settings.music !== undefined) {
          audioOptions.music = settings.music;
          if (!settings.music) stopMusic();
        }
        dispatch({ type: 'settings', settings });
      },
      t: (key, vars) => translate(state.settings.language, key, vars),
    };
  }, [state]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error('useGame must be used inside GameProvider');
  return value;
}
