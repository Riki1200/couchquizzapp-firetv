import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { createGameClient } from './createGameClient';
import { GameClient, GameClientEvent } from './GameClient';
import { Award, Difficulty, GenerationStatus, Player, PlayerResult, Question, QuestionSource, Room } from './types';

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
}

type Action =
  | { type: 'roomCreated'; room: Room }
  | { type: 'setTopic'; topic: string }
  | { type: 'setDifficulty'; difficulty: Difficulty }
  | { type: 'questionStarted'; index: number }
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
      return { ...state, questionIndex: action.index, answeredIds: [], results: null, awards: null };
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
      return { ...state, awards: action.awards };
  }
}

interface GameContextValue {
  state: GameState;
  setTopic: (topic: string) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  /** Creates the room the first time, then (re)starts question generation for the chosen topic. */
  openLobby: () => Promise<void>;
  startQuestion: (index: number) => void;
  reveal: () => void;
  endGame: () => void;
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
          client.configure(state.topic!, state.difficulty!);
        } catch (error) {
          console.warn('[game] could not open the lobby', error);
          dispatch({ type: 'generation', status: 'failed' }); // the lobby offers "Try again"
        }
      },
      startQuestion: (index) => {
        dispatch({ type: 'questionStarted', index });
        client.startQuestion(index);
      },
      reveal: () => client.reveal(state.questionIndex),
      endGame: () => client.endGame(),
    };
  }, [state]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error('useGame must be used inside GameProvider');
  return value;
}
