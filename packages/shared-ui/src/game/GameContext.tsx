import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { GameClient } from './GameClient';
import { MockGameClient } from './MockGameClient';
import { Difficulty, GenerationStatus, Player, Question, Room, ServerEvent } from './types';

export interface GameState {
  room: Room | null;
  players: Player[];
  topic: string | null;
  difficulty: Difficulty | null;
  generation: GenerationStatus;
  questions: Question[];
}

type Action =
  | { type: 'roomCreated'; room: Room }
  | { type: 'setTopic'; topic: string }
  | { type: 'setDifficulty'; difficulty: Difficulty }
  | ServerEvent;

const initialState: GameState = {
  room: null,
  players: [],
  topic: null,
  difficulty: null,
  generation: 'idle',
  questions: [],
};

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'roomCreated':
      return { ...state, room: action.room };
    case 'setTopic':
      return { ...state, topic: action.topic };
    case 'setDifficulty':
      return { ...state, difficulty: action.difficulty };
    case 'players':
      return { ...state, players: action.players };
    case 'generation':
      return { ...state, generation: action.status, questions: action.questions ?? [] };
    default:
      // answerProgress / reveal / gameOver are handled by the game screens (Day 3).
      return state;
  }
}

interface GameContextValue {
  state: GameState;
  setTopic: (topic: string) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  /** Creates the room the first time, then (re)starts question generation for the chosen topic. */
  openLobby: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<GameClient>(new MockGameClient());
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const client = clientRef.current;
    const unsubscribe = client.subscribe(dispatch);
    return () => {
      unsubscribe();
      client.close();
    };
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      setTopic: (topic) => dispatch({ type: 'setTopic', topic }),
      setDifficulty: (difficulty) => dispatch({ type: 'setDifficulty', difficulty }),
      openLobby: async () => {
        const client = clientRef.current;
        if (!state.room) dispatch({ type: 'roomCreated', room: await client.createRoom() });
        client.configure(state.topic!, state.difficulty!);
      },
    }),
    [state],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error('useGame must be used inside GameProvider');
  return value;
}
